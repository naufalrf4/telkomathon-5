from datetime import UTC, datetime, timedelta
from typing import Protocol, cast
from uuid import uuid4

import pytest

from app.exceptions import AlreadyFinalizedException
from app.features.design_sessions.models import DesignSession
from app.features.design_sessions.schemas import CourseContextRequest
from app.features.design_sessions.service import (
    DesignSessionService,
    fallback_elo_options,
    normalize_text_options,
)
from app.features.syllabus.models import GeneratedSyllabus


class HasOptionalId(Protocol):
    id: object | None


class FakeAsyncSession:
    def add(self, obj: HasOptionalId) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()

    async def flush(self) -> None:
        return None

    async def refresh(self, obj: HasOptionalId) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()


class FakeScalarResult:
    def __init__(self, items: list[DesignSession]) -> None:
        self._items: list[DesignSession] = items

    def all(self) -> list[DesignSession]:
        return self._items


class FakeExecuteResult:
    def __init__(self, items: list[DesignSession]) -> None:
        self._items: list[DesignSession] = items

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._items)


@pytest.mark.asyncio
async def test_list_sessions_returns_latest_first() -> None:
    now = datetime.now(UTC)
    older = DesignSession(
        id=uuid4(),
        document_ids=[str(uuid4())],
        wizard_step="summary_ready",
        updated_at=now - timedelta(days=1),
        created_at=now - timedelta(days=2),
    )
    newer = DesignSession(
        id=uuid4(),
        document_ids=[str(uuid4())],
        wizard_step="finalized",
        finalized_syllabus_id=uuid4(),
        updated_at=now,
        created_at=now - timedelta(hours=1),
    )

    class SessionListDB(FakeAsyncSession):
        async def execute(self, _query: object) -> FakeExecuteResult:
            return FakeExecuteResult([newer, older])

    service = DesignSessionService(SessionListDB())

    result = await service.list_sessions()

    assert [session.id for session in result] == [newer.id, older.id]


@pytest.mark.asyncio
async def test_update_course_context_resets_downstream_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_selected",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        tlo_options=[{"id": "tlo-1", "text": "TLO", "rationale": "ok"}],
        selected_tlo={"id": "tlo-1", "text": "TLO", "rationale": "ok"},
        performance_options=[{"id": "performance-1", "text": "Perf", "rationale": "ok"}],
        selected_performance={"id": "performance-1", "text": "Perf", "rationale": "ok"},
        elo_options=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
        selected_elos=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    monkeypatch.setattr(service, "get_session", fake_get_session)

    result = await service.update_course_context(
        uuid4(),
        CourseContextRequest(topic="Data Analytics", target_level=3, additional_context="Ops"),
    )

    assert result.wizard_step == "course_context_set"
    assert result.course_context == {
        "topic": "Data Analytics",
        "target_level": 3,
        "additional_context": "Ops",
        "course_category": "",
        "client_company_name": "",
        "course_title": "",
        "commercial_overview": "",
    }
    assert result.tlo_options == []
    assert result.selected_tlo is None
    assert result.performance_options == []
    assert result.selected_performance is None
    assert result.elo_options == []
    assert result.selected_elos == []
    assert result.finalized_syllabus_id is None


@pytest.mark.asyncio
async def test_select_tlo_resets_downstream_state(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="tlo_options_ready",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={"topic": "Data Analytics", "target_level": 3, "additional_context": "Ops"},
        tlo_options=[
            {"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
            {"id": "tlo-2", "text": "TLO 2", "rationale": "ok"},
        ],
        performance_options=[{"id": "performance-1", "text": "Perf", "rationale": "ok"}],
        selected_performance={"id": "performance-1", "text": "Perf", "rationale": "ok"},
        elo_options=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
        selected_elos=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    monkeypatch.setattr(service, "get_session", fake_get_session)

    result = await service.select_tlo(uuid4(), "tlo-2")

    assert result.wizard_step == "tlo_selected"
    assert result.selected_tlo == {"id": "tlo-2", "text": "TLO 2", "rationale": "ok"}
    assert result.performance_options == []
    assert result.selected_performance is None
    assert result.elo_options == []
    assert result.selected_elos == []
    assert result.finalized_syllabus_id is None


@pytest.mark.asyncio
async def test_select_performance_resets_elo_state(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="performance_options_ready",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={"topic": "Data Analytics", "target_level": 3, "additional_context": "Ops"},
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        performance_options=[
            {"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
            {"id": "performance-2", "text": "Perf 2", "rationale": "ok"},
        ],
        elo_options=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
        selected_elos=[{"id": "elo-1", "elo": "ELO", "rationale": "ok"}],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    monkeypatch.setattr(service, "get_session", fake_get_session)

    result = await service.select_performance(uuid4(), "performance-2")

    assert result.wizard_step == "performance_selected"
    assert result.selected_performance == {
        "id": "performance-2",
        "text": "Perf 2",
        "rationale": "ok",
    }
    assert result.elo_options == []
    assert result.selected_elos == []
    assert result.finalized_syllabus_id is None
    assert isinstance(getattr(result, "preview_condition_result", None), str)
    assert isinstance(getattr(result, "preview_standard_result", None), str)


@pytest.mark.asyncio
async def test_update_course_context_rejects_finalized_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="finalized",
        finalized_syllabus_id=uuid4(),
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    monkeypatch.setattr(service, "get_session", fake_get_session)

    with pytest.raises(AlreadyFinalizedException):
        _ = await service.update_course_context(
            uuid4(),
            CourseContextRequest(topic="Data Analytics", target_level=3, additional_context="Ops"),
        )


@pytest.mark.asyncio
async def test_finalize_sets_syllabus_link(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        id=uuid4(),
        document_ids=[str(uuid4())],
        wizard_step="elo_selected",
        source_summary={
            "summary": "Business Profile (Dummy): Organization Context\nThe company operates in digital connectivity services and focuses on talent capability improvement.",
            "key_points": ["Poin 1"],
            "company_profile_focus": [
                "transformasi layanan digital lintas fungsi",
                "peningkatan kapabilitas talenta organisasi",
            ],
        },
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "Konteks bisnis",
            "course_category": "Technical",
            "client_company_name": "PT Demo",
            "course_title": "Data Analytics Bootcamp",
            "commercial_overview": "Program akselerasi analitik.",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Performance", "rationale": "ok"},
        selected_elos=[{"id": "elo-1", "elo": "ELO 1", "rationale": "ok"}],
    )
    syllabus = GeneratedSyllabus(
        id=uuid4(),
        topic="Data Analytics",
        target_level=3,
        course_category="Technical",
        client_company_name="PT Demo",
        course_title="Data Analytics Bootcamp",
        company_profile_summary="Ringkasan perusahaan",
        commercial_overview="Program akselerasi analitik.",
        tlo="TLO",
        performance_result="Performance",
        condition_result="Condition",
        standard_result="Standard",
        elos=[{"elo": "ELO 1"}],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "description": "Persiapan awal",
                "content": ["Review konsep"],
            },
            "classroom": {
                "duration": "1 hari",
                "description": "Workshop inti",
                "content": ["Diskusi kasus"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "description": "Implementasi",
                "content": ["Rencana aksi"],
            },
        },
        source_doc_ids=[],
        revision_history=[],
        status="finalized",
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    captured_kwargs: dict[str, object] = {}

    async def fake_create_finalized_syllabus(_self: object, **kwargs: object) -> GeneratedSyllabus:
        captured_kwargs.update(kwargs)
        return syllabus

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(
        "app.features.syllabus.service.SyllabusService.create_finalized_syllabus",
        fake_create_finalized_syllabus,
    )

    result_session, result_syllabus = await service.finalize(uuid4())

    assert result_syllabus.id == syllabus.id
    assert result_session.finalized_syllabus_id == syllabus.id
    assert result_session.wizard_step == "finalized"
    assert captured_kwargs["course_category"] == "Technical"
    assert captured_kwargs["client_company_name"] == "PT Demo"
    assert captured_kwargs["course_title"] == "Data Analytics Bootcamp"
    assert captured_kwargs["company_profile_summary"] == (
        "Perusahaan memiliki konteks bisnis dan kebutuhan pembelajaran yang menjadi dasar penyusunan silabus. Fokus utama perusahaan mencakup transformasi layanan digital lintas fungsi dan peningkatan kapabilitas talenta organisasi."
    )
    assert captured_kwargs["commercial_overview"] == "Program akselerasi analitik."
    assert captured_kwargs["performance_result"] == "Performance"
    assert isinstance(captured_kwargs["condition_result"], str)
    assert isinstance(captured_kwargs["standard_result"], str)


def test_normalize_text_options_uses_prefix() -> None:
    payload = {"options": [{"text": "Opsi A", "rationale": "Alasan A"}]}
    result = normalize_text_options(payload, "tlo")
    assert result == [{"id": "tlo-1", "text": "Opsi A", "rationale": "Alasan A"}]


def test_fallback_elo_options_return_multiple_entries() -> None:
    result = fallback_elo_options("Data Analytics", "Performance Focus")
    assert len(result) == 5
    for item in result:
        item_id = item.get("id")
        assert isinstance(item_id, str)
        assert item_id.startswith("elo-")
        elo = cast(str, item.get("elo"))
        assert isinstance(elo, str)
        assert elo
