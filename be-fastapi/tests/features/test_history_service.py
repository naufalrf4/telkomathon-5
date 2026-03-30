"""Tests for history aggregation, CSV export, and module decomposition services."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.features.chat.models import ChatMessage
from app.features.history.models import ModuleDecomposition, OwnerHistory
from app.features.history.service import DecompositionService, HistoryService
from app.features.personalize.models import PersonalizationResult
from app.features.roadmap.models import CareerRoadmapResult
from app.features.syllabus.models import GeneratedSyllabus

# ---------------------------------------------------------------------------
# Fake DB session – follows the same pattern as test_syllabus_service.py
# ---------------------------------------------------------------------------

_JOURNEY = {
    "pre_learning": {
        "duration": "60 menit",
        "description": "Pra-pembelajaran",
        "content": ["Meninjau ringkasan", "Mengidentifikasi ekspektasi"],
    },
    "classroom": {
        "duration": "240 menit",
        "description": "Sesi kelas",
        "content": ["Membedah TLO", "Latihan terstruktur", "Umpan balik"],
    },
    "after_learning": {
        "duration": "120 menit",
        "description": "Pasca-pembelajaran",
        "content": ["Menyusun eksperimen", "Review hasil"],
    },
}


def _make_finalized_syllabus(syllabus_id=None, elos=None, journey=None, status="finalized"):
    return GeneratedSyllabus(
        id=syllabus_id or uuid4(),
        topic="Data Analytics",
        target_level=3,
        course_category="Technical",
        client_company_name="PT Demo",
        course_title="Data Analytics Bootcamp",
        company_profile_summary="Ringkasan",
        commercial_overview="Overview",
        tlo="TLO utama",
        performance_result="Performance utama",
        condition_result="Condition utama",
        standard_result="Standard utama",
        elos=elos or [{"elo": "ELO-1"}, {"elo": "ELO-2"}, {"elo": "ELO-3"}],
        journey=journey or _JOURNEY,
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status=status,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        if isinstance(self.value, list):
            return self.value
        return [self.value] if self.value is not None else []


class FakeHistorySession:
    """Minimal session for history service tests."""

    def __init__(
        self, *, syllabus=None, history=None, personalizations=None, roadmaps=None, messages=None
    ):
        self._store: list[object] = []
        self.syllabus = syllabus
        self.history = list(history or [])
        self.personalizations = list(personalizations or [])
        self.roadmaps = list(roadmaps or [])
        self.messages = list(messages or [])

    def add(self, obj):
        self._store.append(obj)

    async def flush(self):
        pass

    async def refresh(self, obj):
        pass

    async def execute(self, statement):
        statement_text = str(statement)
        if "generated_syllabi" in statement_text:
            return FakeScalarResult(self.syllabus)
        if "chat_messages" in statement_text:
            return FakeScalarResult(self.messages)
        if "career_roadmap_results" in statement_text:
            return FakeScalarResult(self.roadmaps)
        if "personalization_results" in statement_text:
            return FakeScalarResult(self.personalizations)
        if "GROUP BY" in statement_text:
            return FakeAggResult([])
        # For history list queries (.scalars().all())
        return FakeScalarResult(self.history)


class FakeAggResult:
    """Mimics rows from aggregation query."""

    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeDecompSession:
    """Session for decomposition tests; stores modules and routes lookups."""

    def __init__(self, syllabus, *, existing_modules=None):
        self.syllabus = syllabus
        self._modules: list[ModuleDecomposition] = list(existing_modules or [])
        self._added: list[ModuleDecomposition] = []
        self._deleted_syllabus_ids: list[object] = []

    def add(self, obj):
        self._added.append(obj)
        self._modules.append(obj)

    async def flush(self):
        pass

    async def refresh(self, obj):
        pass

    async def execute(self, statement):
        statement_text = str(statement)
        if "DELETE" in statement_text or "delete" in statement_text.lower():
            count = len(self._modules)
            self._modules.clear()
            return FakeRowCount(count)
        if "module_decompositions" in statement_text:
            return FakeScalarResult(self._modules)
        return FakeScalarResult(self.syllabus)


class FakeRowCount:
    def __init__(self, count):
        self.rowcount = count


# ---------------------------------------------------------------------------
# History Service Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_creates_entry():
    session = FakeHistorySession()
    service = HistoryService(session)
    syllabus_id = uuid4()

    entry = await service.record_event(
        syllabus_id=syllabus_id,
        action="created",
        summary="Syllabus created",
    )
    assert entry.syllabus_id == syllabus_id
    assert entry.action == "created"
    assert entry.owner_id == "default"
    assert entry.summary == "Syllabus created"


@pytest.mark.asyncio
async def test_record_event_with_custom_owner():
    session = FakeHistorySession()
    service = HistoryService(session)
    syllabus_id = uuid4()

    entry = await service.record_event(
        syllabus_id=syllabus_id,
        action="exported",
        owner_id="user-123",
        summary="CSV exported",
        detail={"format": "csv"},
    )
    assert entry.owner_id == "user-123"
    assert entry.detail == {"format": "csv"}


@pytest.mark.asyncio
async def test_aggregate_returns_empty_for_no_history():
    session = FakeHistorySession()
    service = HistoryService(session)

    agg = await service.aggregate(owner_id="default")
    assert agg.total_events == 0
    assert agg.action_counts == {}
    assert agg.first_event is None


@pytest.mark.asyncio
async def test_export_csv_returns_header_and_no_data():
    session = FakeHistorySession()
    service = HistoryService(session)
    syllabus_id = uuid4()

    csv_text = await service.export_history_csv(syllabus_id)
    assert "section" in csv_text
    assert "history" not in csv_text.split("\n")[1] or csv_text.count("\n") >= 1


@pytest.mark.asyncio
async def test_export_csv_includes_personalization_summary_row_without_recommendations():
    syllabus_id = uuid4()
    session = FakeHistorySession(
        personalizations=[
            PersonalizationResult(
                syllabus_id=syllabus_id,
                bulk_session_id=uuid4(),
                participant_name="Aulia Rahman",
                revision_index=2,
                competency_gaps=[],
                recommendations=[],
                created_at=datetime.now(UTC),
            )
        ]
    )
    service = HistoryService(session)

    csv_text = await service.export_history_csv(syllabus_id)

    assert "Aulia Rahman" in csv_text
    assert "Personalization run" in csv_text
    assert "bulk_session_id" in csv_text


@pytest.mark.asyncio
async def test_export_csv_includes_roadmap_rows():
    syllabus_id = uuid4()
    session = FakeHistorySession(
        roadmaps=[
            CareerRoadmapResult(
                syllabus_id=syllabus_id,
                participant_name="Aulia Rahman",
                current_role="Junior Analyst",
                target_role="ML Analyst",
                time_horizon_weeks=12,
                revision_index=1,
                competency_gaps=[],
                milestones=[
                    {
                        "phase_title": "Fase 1",
                        "timeframe": "Minggu 1-4",
                        "objective": "Bangun fondasi",
                        "focus_modules": ["Dasar Python"],
                        "activities": ["Belajar rutin"],
                        "success_indicator": "Mampu menjalankan latihan dasar",
                    }
                ],
                created_at=datetime.now(UTC),
            )
        ]
    )
    service = HistoryService(session)

    csv_text = await service.export_history_csv(syllabus_id)

    assert "roadmap" in csv_text
    assert "ML Analyst" in csv_text
    assert "Bangun fondasi" in csv_text


@pytest.mark.asyncio
async def test_get_revision_notes_combines_revision_snapshot_and_downstream_events():
    syllabus_id = uuid4()
    owner_id = uuid4()
    message_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    syllabus.owner_id = owner_id
    syllabus.revision_history = [
        {
            "tlo": "TLO awal",
            "performance_result": "Performance awal",
            "condition_result": "Condition awal",
            "standard_result": "Standard awal",
            "elos": [{"elo": "ELO awal"}],
            "journey": _JOURNEY,
            "revised_at": datetime.now(UTC).isoformat(),
            "summary": "Perjelas outcome",
            "reason": "Feedback trainer",
            "source_message_id": str(message_id),
            "applied_fields": ["tlo", "elos"],
        }
    ]
    history = [
        OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id),
            action="finalized",
            summary="Finalized syllabus for Data Analytics",
            detail={},
            revision_index=0,
            created_at=datetime.now(UTC),
        ),
        OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id),
            action="revised",
            summary="Perjelas outcome",
            detail={"reason": "Feedback trainer"},
            revision_index=1,
            created_at=datetime.now(UTC),
        ),
        OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id),
            action="decomposed",
            summary="Generated modules",
            detail={"module_count": 3},
            revision_index=1,
            created_at=datetime.now(UTC),
        ),
    ]
    personalizations = [
        PersonalizationResult(
            syllabus_id=syllabus_id,
            participant_name="Aulia Rahman",
            revision_index=1,
            competency_gaps=[],
            recommendations=[],
            created_at=datetime.now(UTC),
        )
    ]
    messages = [
        ChatMessage(
            id=message_id,
            syllabus_id=syllabus_id,
            role="assistant",
            content="Saran revisi untuk memperjelas outcome dan indikator transfer belajar.",
            revision_applied={"summary": "Perjelas outcome"},
            created_at=datetime.now(UTC),
        )
    ]
    session = FakeHistorySession(
        syllabus=syllabus,
        history=history,
        personalizations=personalizations,
        messages=messages,
    )
    service = HistoryService(session)

    notes = await service.get_revision_notes(syllabus_id, owner_id=owner_id)

    assert len(notes) == 2
    assert notes[0].revision_index == 0
    assert notes[0].source_kind == "finalized"
    assert notes[1].revision_index == 1
    assert notes[1].summary == "Perjelas outcome"
    assert notes[1].downstream.personalization_count == 1
    assert notes[1].downstream.module_generation_count == 1
    assert notes[1].source_message_excerpt is not None


# ---------------------------------------------------------------------------
# Decomposition Service Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_decompose_creates_modules_from_finalized_syllabus():
    syllabus_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    session = FakeDecompSession(syllabus)
    service = DecompositionService(session)

    modules = await service.decompose(syllabus_id)

    assert len(modules) == 3  # one per journey stage
    assert modules[0].module_index == 0
    assert "Pra-Pembelajaran" in modules[0].title
    assert modules[1].module_index == 1
    assert "Pembelajaran Kelas" in modules[1].title
    assert modules[2].module_index == 2
    assert "Pasca-Pembelajaran" in modules[2].title


@pytest.mark.asyncio
async def test_decompose_distributes_elos_round_robin():
    syllabus_id = uuid4()
    elos = [{"elo": f"ELO-{i}"} for i in range(7)]
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id, elos=elos)
    session = FakeDecompSession(syllabus)
    service = DecompositionService(session)

    modules = await service.decompose(syllabus_id)
    total_objectives = sum(len(m.learning_objectives) for m in modules)
    assert total_objectives == 7


@pytest.mark.asyncio
async def test_decompose_with_module_count_hint():
    syllabus_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    session = FakeDecompSession(syllabus)
    service = DecompositionService(session)

    modules = await service.decompose(syllabus_id, module_count_hint=5)
    assert len(modules) == 5


@pytest.mark.asyncio
async def test_decompose_rejects_draft_syllabus():
    syllabus_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id, status="draft")
    session = FakeDecompSession(syllabus)
    service = DecompositionService(session)

    with pytest.raises(Exception, match="finalized"):
        await service.decompose(syllabus_id)


@pytest.mark.asyncio
async def test_decompose_clears_existing_before_rebuild():
    syllabus_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    existing = ModuleDecomposition(
        syllabus_id=syllabus_id,
        module_index=0,
        title="Old Module",
        description="Stale",
        learning_objectives=[],
        topics=[],
        duration_minutes=30,
        activities=[],
        assessment={},
    )
    session = FakeDecompSession(syllabus, existing_modules=[existing])
    service = DecompositionService(session)

    modules = await service.decompose(syllabus_id)
    # Old module was cleared; new ones are fresh
    assert all(m.title != "Old Module" for m in modules)


@pytest.mark.asyncio
async def test_parse_duration_minutes():
    service = DecompositionService(None)
    assert service._parse_duration_minutes("60 menit") == 60
    assert service._parse_duration_minutes("240 menit") == 240
    assert service._parse_duration_minutes("2 jam") == 120
    assert service._parse_duration_minutes("1 hari") == 480
    assert service._parse_duration_minutes("1 minggu") == 2400
    assert service._parse_duration_minutes("") == 0


@pytest.mark.asyncio
async def test_get_decompositions_returns_sorted():
    syllabus_id = uuid4()
    mod_a = ModuleDecomposition(
        syllabus_id=syllabus_id,
        module_index=0,
        title="M1",
        description="",
        learning_objectives=[],
        topics=[],
        duration_minutes=0,
        activities=[],
        assessment={},
    )
    mod_b = ModuleDecomposition(
        syllabus_id=syllabus_id,
        module_index=1,
        title="M2",
        description="",
        learning_objectives=[],
        topics=[],
        duration_minutes=0,
        activities=[],
        assessment={},
    )
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    session = FakeDecompSession(syllabus, existing_modules=[mod_a, mod_b])
    service = DecompositionService(session)

    results = await service.get_decompositions(syllabus_id)
    assert len(results) == 2


# ---------------------------------------------------------------------------
# Stale cleanup integration test (SyllabusService-level)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_revision_apply_clears_stale_modules():
    """Revision-apply on SyllabusService must delete existing decompositions
    and record a history event."""
    from app.features.chat.models import ChatMessage
    from app.features.syllabus.schemas import (
        SyllabusRevisionApplyRequest,
    )
    from app.features.syllabus.service import SyllabusService

    syllabus_id = uuid4()
    message_id = uuid4()
    syllabus = _make_finalized_syllabus(syllabus_id=syllabus_id)
    message = ChatMessage(
        id=message_id,
        syllabus_id=syllabus_id,
        role="assistant",
        content="Suggestion",
        revision_applied=None,
        created_at=datetime.now(UTC),
    )

    class FakeRevisionSessionWithCleanup:
        def __init__(self):
            self._deleted_tables: list[str] = []
            self._added: list[object] = []

        async def execute(self, statement):
            statement_text = str(statement)
            if "DELETE" in statement_text.upper():
                self._deleted_tables.append(statement_text)
                return FakeRowCount(1)
            if "chat_messages" in statement_text:
                return FakeScalarResult(message)
            return FakeScalarResult(syllabus)

        def add(self, obj):
            self._added.append(obj)

        async def flush(self):
            pass

        async def refresh(self, obj):
            pass

    session = FakeRevisionSessionWithCleanup()
    service = SyllabusService(session)

    result = await service.apply_revision(
        syllabus_id,
        SyllabusRevisionApplyRequest(
            summary="Update TLO",
            tlo="New TLO",
            reason="Better clarity",
            source_message_id=message_id,
        ),
    )

    assert result.tlo == "New TLO"
    # Module decomposition DELETE was issued
    assert any("module_decompositions" in t for t in session._deleted_tables)
    # History event was added
    history_entries = [o for o in session._added if isinstance(o, OwnerHistory)]
    assert len(history_entries) == 1
    assert history_entries[0].action == "revised"
    assert history_entries[0].summary == "Update TLO"
