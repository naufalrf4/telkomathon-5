from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast
from uuid import uuid4

import pytest

from app.exceptions import AIServiceException, AlreadyFinalizedException
from app.features.design_sessions.models import DesignSession
from app.features.design_sessions.schemas import CourseContextRequest, DesignSessionCreateRequest
from app.features.design_sessions.service import (
    DesignSessionService,
    fallback_elo_options,
    fallback_source_summary,
    fallback_tlo_options,
    matches_tlo_level,
    normalize_text_options,
)
from app.features.documents.models import Document
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
    def __init__(self, items: list[object]) -> None:
        self._items = items

    def all(self) -> list[object]:
        return self._items


class FakeExecuteResult:
    def __init__(self, items: list[object]) -> None:
        self._items = items

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._items)

    def scalar_one_or_none(self) -> DesignSession | Document | None:
        value = self._items[0] if self._items else None
        if isinstance(value, DesignSession | Document):
            return value
        return None


@pytest.mark.asyncio
async def test_create_session_prefills_company_context(monkeypatch: pytest.MonkeyPatch) -> None:
    document_id = uuid4()
    document = Document(
        id=document_id,
        filename="profil-perusahaan.docx",
        doc_type="company-profile",
        file_format="docx",
        content_text="PT Demo bergerak di layanan digital dan konektivitas. Fokus utama perusahaan adalah peningkatan kapabilitas talenta organisasi.",
        file_path="uploads/profil-perusahaan.docx",
        status="ready",
        metadata_={
            "extraction": {
                "company_name": "PT Demo",
                "company_profile_summary": "PT Demo bergerak di layanan digital dan konektivitas. Fokus utama tahun berjalan adalah peningkatan kapabilitas talenta organisasi.",
                "confidence": "high",
            }
        },
    )

    class SessionCreateDB(FakeAsyncSession):
        async def execute(self, _query: object) -> FakeExecuteResult:
            return FakeExecuteResult([document])

    service = DesignSessionService(SessionCreateDB())

    async def fake_generate_source_summary(_documents: object) -> dict[str, object]:
        return {
            "summary": "Ringkasan AI",
            "key_points": ["Poin AI 1"],
            "company_name": "PT Demo AI",
            "company_profile_summary": "PT Demo AI berfokus pada transformasi layanan digital lintas fungsi.",
            "company_profile_confidence": "high",
            "company_profile_focus": ["transformasi layanan digital lintas fungsi"],
        }

    monkeypatch.setattr(service, "_generate_source_summary", fake_generate_source_summary)

    created = await service.create_session(
        DesignSessionCreateRequest(document_ids=[document_id]),
    )

    assert created.wizard_step == "summary_ready"
    assert created.source_summary is not None
    assert created.source_summary["company_name"] == "PT Demo AI"
    assert created.course_context is not None
    assert created.course_context["client_company_name"] == "PT Demo AI"
    assert str(created.course_context["commercial_overview"]).startswith("PT Demo AI berfokus")


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
async def test_generate_elo_options_passes_previous_options_for_regeneration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_options_ready",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Machine Learning Level 1",
            "target_level": 1,
            "additional_context": "Ops",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
        elo_options=[
            {"id": "elo-1", "elo": "Mendefinisikan konsep dasar.", "rationale": "ok"},
            {"id": "elo-2", "elo": "Mengidentifikasi komponen utama.", "rationale": "ok"},
        ],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    captured_previous: list[str] = []

    async def fake_generate(
        source_summary: dict[str, object],
        course_context: dict[str, object],
        selected_tlo: dict[str, object],
        selected_performance: dict[str, object],
        previous_elo_texts: list[str],
    ) -> list[dict[str, object]]:
        _ = source_summary, course_context, selected_tlo, selected_performance
        captured_previous.extend(previous_elo_texts)
        return [{"id": "elo-9", "elo": "Menyebutkan istilah inti.", "rationale": "baru"}]

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(service, "_generate_elo_options", fake_generate)

    result = await service.generate_elo_options(uuid4())

    assert captured_previous == [
        "Mendefinisikan konsep dasar.",
        "Mengidentifikasi komponen utama.",
    ]
    assert result.elo_options == [
        {"id": "elo-9", "elo": "Menyebutkan istilah inti.", "rationale": "baru"}
    ]


def test_fallback_elo_options_support_regeneration_variant() -> None:
    initial = cast(
        list[dict[str, str]], fallback_elo_options("Machine Learning Level 1", "Performance")
    )
    regenerated = cast(
        list[dict[str, str]],
        fallback_elo_options(
            "Machine Learning Level 1",
            "Performance",
            regenerate=True,
            previous_elo_texts=[item["elo"] for item in initial],
        ),
    )
    regenerated_again = cast(
        list[dict[str, str]],
        fallback_elo_options(
            "Machine Learning Level 1",
            "Performance",
            regenerate=True,
            previous_elo_texts=[item["elo"] for item in regenerated],
        ),
    )

    assert len(initial) == 5
    assert len(regenerated) == 5
    assert len(regenerated_again) == 5
    assert initial[0]["elo"] != regenerated[0]["elo"]
    assert regenerated[0]["elo"].startswith("Menyebutkan")
    assert regenerated_again[0]["elo"] != regenerated[0]["elo"]
    assert regenerated_again[0]["elo"].startswith("Menjabarkan")


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

    async def fake_chat_complete_json(_messages: object) -> dict[str, object]:
        return {
            "condition_result": "Peserta menunjukkan performa dalam studi kasus operasional yang relevan dengan kebutuhan analitik perusahaan.",
            "standard_result": "Keberhasilan peserta diukur melalui ketepatan insight, ketuntasan analisis, dan kejelasan rekomendasi yang dapat ditindaklanjuti.",
            "journey": {
                "pre_learning": {
                    "duration": "60 menit",
                    "method": ["Belajar mandiri terarah", "Review materi pengantar"],
                    "description": "Peserta membangun pemahaman awal terhadap konteks analitik data yang akan digunakan di kelas.",
                    "content": [
                        "Peran analitik data dalam proses kerja",
                        "Istilah inti dan indikator data dasar",
                    ],
                },
                "classroom": {
                    "duration": "240 menit",
                    "method": ["Workshop terpandu", "Diskusi studi kasus"],
                    "description": "Peserta mempraktikkan pembacaan data dan penyusunan insight melalui latihan terstruktur.",
                    "content": [
                        "Membaca dashboard operasional",
                        "Menyusun insight berbasis data",
                        "Membuat rekomendasi perbaikan",
                    ],
                },
                "after_learning": {
                    "duration": "120 menit",
                    "method": ["Tugas penerapan mandiri", "Umpan balik atasan atau fasilitator"],
                    "description": "Peserta menerapkan hasil belajar pada konteks kerja sederhana dan menyiapkan tindak lanjut.",
                    "content": [
                        "Penerapan insight pada kasus kerja",
                        "Rencana tindak lanjut berbasis data",
                    ],
                },
            },
        }

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(
        "app.features.design_sessions.service.chat_complete_json", fake_chat_complete_json
    )
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
    assert captured_kwargs["condition_result"] == (
        "Peserta menunjukkan performa dalam studi kasus operasional yang relevan dengan kebutuhan analitik perusahaan."
    )
    assert captured_kwargs["standard_result"] == (
        "Keberhasilan peserta diukur melalui ketepatan insight, ketuntasan analisis, dan kejelasan rekomendasi yang dapat ditindaklanjuti."
    )
    assert captured_kwargs["journey"] == {
        "pre_learning": {
            "duration": "60 menit",
            "method": ["Belajar mandiri terarah", "Review materi pengantar"],
            "description": "Peserta membangun pemahaman awal terhadap konteks analitik data yang akan digunakan di kelas.",
            "content": [
                "Peran analitik data dalam proses kerja",
                "Istilah inti dan indikator data dasar",
            ],
        },
        "classroom": {
            "duration": "240 menit",
            "method": ["Workshop terpandu", "Diskusi studi kasus"],
            "description": "Peserta mempraktikkan pembacaan data dan penyusunan insight melalui latihan terstruktur.",
            "content": [
                "Membaca dashboard operasional",
                "Menyusun insight berbasis data",
                "Membuat rekomendasi perbaikan",
            ],
        },
        "after_learning": {
            "duration": "120 menit",
            "method": ["Tugas penerapan mandiri", "Umpan balik atasan atau fasilitator"],
            "description": "Peserta menerapkan hasil belajar pada konteks kerja sederhana dan menyiapkan tindak lanjut.",
            "content": [
                "Penerapan insight pada kasus kerja",
                "Rencana tindak lanjut berbasis data",
            ],
        },
    }
    generation_meta = cast(dict[str, object], captured_kwargs["generation_meta"])
    assert (
        cast(dict[str, object], generation_meta["condition_result"])["source"]
        == "ai_final_synthesis"
    )
    assert (
        cast(dict[str, object], generation_meta["journey"])["prompt_version"]
        == "final-synthesis-v1"
    )
    assert cast(dict[str, object], generation_meta["commercial_overview"])["source"] == "user_input"


@pytest.mark.asyncio
async def test_finalize_retries_when_final_sections_overlap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        id=uuid4(),
        document_ids=[str(uuid4())],
        wizard_step="elo_selected",
        source_summary={"summary": "Ringkasan bisnis", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "",
            "course_category": "Technical",
            "client_company_name": "PT Demo",
            "course_title": "Data Analytics Bootcamp",
            "commercial_overview": "Program analitik data untuk tim operasional.",
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
        commercial_overview="Program analitik data untuk tim operasional.",
        tlo="TLO",
        performance_result="Performance",
        condition_result="Condition",
        standard_result="Standard",
        elos=[{"elo": "ELO 1"}],
        journey={
            "pre_learning": {"duration": "30 menit", "description": "x", "content": ["x"]},
            "classroom": {"duration": "1 hari", "description": "x", "content": ["x"]},
            "after_learning": {"duration": "1 minggu", "description": "x", "content": ["x"]},
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

    responses: list[dict[str, object]] = [
        {
            "condition_result": "Performance",
            "standard_result": "Performance",
            "journey": {
                "pre_learning": {
                    "duration": "60 menit",
                    "method": ["Belajar mandiri"],
                    "description": "Performance",
                    "content": ["Performance"],
                },
                "classroom": {
                    "duration": "240 menit",
                    "method": ["Workshop"],
                    "description": "Performance",
                    "content": ["Performance"],
                },
                "after_learning": {
                    "duration": "120 menit",
                    "method": ["Tugas mandiri"],
                    "description": "Performance",
                    "content": ["Performance"],
                },
            },
        },
        {
            "condition_result": "Peserta menunjukkan performa pada studi kasus data operasional yang relevan dengan kebutuhan tim.",
            "standard_result": "Keberhasilan peserta ditunjukkan melalui akurasi insight dan ketepatan rekomendasi yang dapat dijalankan.",
            "journey": {
                "pre_learning": {
                    "duration": "60 menit",
                    "method": ["Belajar mandiri terstruktur"],
                    "description": "Peserta menyiapkan pemahaman awal tentang konteks data operasional.",
                    "content": ["Pengantar metrik operasional", "Istilah inti analitik data"],
                },
                "classroom": {
                    "duration": "240 menit",
                    "method": ["Workshop praktik", "Diskusi studi kasus"],
                    "description": "Peserta berlatih membaca data dan membangun insight dari kasus yang disediakan.",
                    "content": ["Membaca dashboard", "Menghubungkan data dengan keputusan kerja"],
                },
                "after_learning": {
                    "duration": "120 menit",
                    "method": ["Tugas penerapan", "Umpan balik hasil"],
                    "description": "Peserta menindaklanjuti pembelajaran melalui penerapan sederhana di pekerjaan.",
                    "content": ["Rencana tindak lanjut", "Review hasil penerapan"],
                },
            },
        },
    ]

    async def fake_chat_complete_json(_messages: object) -> dict[str, object]:
        return responses.pop(0)

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(
        "app.features.design_sessions.service.chat_complete_json", fake_chat_complete_json
    )
    monkeypatch.setattr(
        "app.features.syllabus.service.SyllabusService.create_finalized_syllabus",
        fake_create_finalized_syllabus,
    )

    _ = await service.finalize(uuid4())

    assert captured_kwargs["condition_result"] == (
        "Peserta menunjukkan performa pada studi kasus data operasional yang relevan dengan kebutuhan tim."
    )
    assert responses == []


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


def test_fallback_source_summary_avoids_filename_only_focus() -> None:
    document = Document(
        filename="06f01a7683_0259dcdfc3.pdf",
        doc_type="company-profile",
        file_format="pdf",
        file_path="/tmp/company.pdf",
        content_text=(
            "Perusahaan menyediakan layanan konektivitas digital untuk pelanggan enterprise di berbagai wilayah. "
            "Fokus strategis tahun berjalan mencakup transformasi layanan digital dan peningkatan kapabilitas talenta organisasi. "
            "Program pembelajaran diarahkan untuk memperkuat literasi data dan pengambilan keputusan berbasis operasional."
        ),
    )

    result = fallback_source_summary([document])

    summary = cast(str, result["summary"])
    assert "06f01a7683_0259dcdfc3.pdf" not in summary
    assert any(
        "transformasi layanan digital" in point.lower()
        for point in cast(list[str], result["company_profile_focus"])
    )


def test_fallback_tlo_options_follow_level_family() -> None:
    level_one = fallback_tlo_options("Machine Learning", 1)
    level_four = fallback_tlo_options("Machine Learning", 4)

    first_text = cast(str, level_one[0]["text"])
    second_level_four_text = cast(str, level_four[1]["text"])

    assert first_text.startswith("Peserta mampu mengidentifikasi")
    assert "mengevaluasi" in second_level_four_text.lower()


def test_matches_tlo_level_rejects_generic_non_measurable_verbs() -> None:
    assert not matches_tlo_level("Peserta mampu memahami dasar machine learning.", 1)
    assert not matches_tlo_level("Peserta mampu menerapkan dan memahami workflow data.", 3)
    assert not matches_tlo_level("Peserta mampu menguasai evaluasi model.", 4)
    assert matches_tlo_level("Peserta mampu menerapkan workflow data untuk kasus kerja.", 3)


@pytest.mark.asyncio
async def test_select_elos_populates_ai_preview_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_options_ready",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
        elo_options=[
            {"id": "elo-1", "elo": "ELO 1", "rationale": "ok"},
            {"id": "elo-2", "elo": "ELO 2", "rationale": "ok"},
        ],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    async def fake_generate_final_sections(**_kwargs: object) -> dict[str, object]:
        return {
            "condition_result": "cond",
            "standard_result": "std",
            "journey": {},
        }

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(service, "_generate_final_sections", fake_generate_final_sections)

    result = await service.select_elos(uuid4(), ["elo-1"])

    assert isinstance(result.ai_preview_sections, dict)
    assert result.ai_preview_sections["condition_result"] == "cond"
    assert result.ai_preview_sections["standard_result"] == "std"


@pytest.mark.asyncio
async def test_select_elos_ai_preview_failure_is_silenced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = DesignSessionService(db)
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_options_ready",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
        elo_options=[
            {"id": "elo-1", "elo": "ELO 1", "rationale": "ok"},
        ],
    )

    async def fake_get_session(_: object) -> DesignSession:
        return session

    async def fake_generate_final_sections(**_kwargs: object) -> dict[str, object]:
        raise AIServiceException("AI failed")

    monkeypatch.setattr(service, "get_session", fake_get_session)
    monkeypatch.setattr(service, "_generate_final_sections", fake_generate_final_sections)

    result = await service.select_elos(uuid4(), ["elo-1"])

    assert result.ai_preview_sections is None


@pytest.mark.asyncio
async def test_attach_preview_fields_uses_ai_sections_when_available() -> None:
    service = DesignSessionService(FakeAsyncSession())
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_selected",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
        selected_elos=[{"id": "elo-1", "elo": "ELO 1", "rationale": "ok"}],
        ai_preview_sections={
            "condition_result": "AI cond",
            "standard_result": "AI std",
        },
    )

    service._attach_preview_fields(session)

    preview_session = cast(Any, session)
    assert preview_session.preview_condition_result == "AI cond"
    assert preview_session.preview_standard_result == "AI std"


@pytest.mark.asyncio
async def test_attach_preview_fields_falls_back_to_template_when_no_ai_sections() -> None:
    service = DesignSessionService(FakeAsyncSession())
    session = DesignSession(
        document_ids=[str(uuid4())],
        wizard_step="elo_selected",
        source_summary={"summary": "Ringkasan", "key_points": ["Poin 1"]},
        course_context={
            "topic": "Data Analytics",
            "target_level": 3,
            "additional_context": "",
        },
        selected_tlo={"id": "tlo-1", "text": "TLO 1", "rationale": "ok"},
        selected_performance={"id": "performance-1", "text": "Perf 1", "rationale": "ok"},
        selected_elos=[{"id": "elo-1", "elo": "ELO 1", "rationale": "ok"}],
        ai_preview_sections=None,
    )

    service._attach_preview_fields(session)

    preview_session = cast(Any, session)
    preview_condition = preview_session.preview_condition_result
    preview_standard = preview_session.preview_standard_result
    assert preview_condition is not None
    assert preview_standard is not None
    assert preview_condition != "AI cond"
    assert preview_standard != "AI std"
    assert "Peserta menunjukkan performa" in preview_condition
    assert "Keberhasilan peserta diukur" in preview_standard
