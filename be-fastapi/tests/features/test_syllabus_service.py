from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.features.chat.models import ChatMessage
from app.features.history.models import OwnerHistory
from app.features.syllabus.models import GeneratedSyllabus
from app.features.syllabus.schemas import (
    ELO,
    LearningJourney,
    LearningJourneyStage,
    SyllabusRevisionApplyRequest,
)
from app.features.syllabus.service import SyllabusService


class FakeScalarResult:
    def __init__(self, value: object) -> None:
        self.value: object = value

    def scalar_one_or_none(self) -> object:
        return self.value


class FakeRevisionSession:
    def __init__(self, syllabus: GeneratedSyllabus, message: ChatMessage | None) -> None:
        self.syllabus: GeneratedSyllabus = syllabus
        self.message: ChatMessage | None = message
        self.added: list[object] = []

    async def execute(self, statement: object) -> FakeScalarResult:
        statement_text = str(statement)
        if "chat_messages" in statement_text:
            return FakeScalarResult(self.message)
        return FakeScalarResult(self.syllabus)

    def add(self, _obj: object) -> None:
        self.added.append(_obj)
        return None

    async def flush(self) -> None:
        return None

    async def refresh(self, _obj: object) -> None:
        return None


@pytest.mark.asyncio
async def test_apply_revision_updates_history_and_marks_chat_message() -> None:
    syllabus_id = uuid4()
    message_id = uuid4()
    syllabus = GeneratedSyllabus(
        id=syllabus_id,
        topic="Data Analytics",
        target_level=3,
        course_category="Technical",
        client_company_name="PT Demo",
        course_title="Data Analytics Bootcamp",
        company_profile_summary="Ringkasan perusahaan",
        commercial_overview="Program akselerasi analitik.",
        tlo="TLO lama",
        performance_result="Performance lama",
        condition_result="Condition lama",
        standard_result="Standard lama",
        elos=[{"elo": "ELO lama"}],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "method": "Metode pre lama",
                "description": "Pre lama",
                "content": ["Pre lama"],
            },
            "classroom": {
                "duration": "1 hari",
                "method": "Metode class lama",
                "description": "Class lama",
                "content": ["Class lama"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "method": "Metode after lama",
                "description": "After lama",
                "content": ["After lama"],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    message = ChatMessage(
        id=message_id,
        syllabus_id=syllabus_id,
        role="assistant",
        content="Saran revisi",
        revision_applied=None,
        created_at=datetime.now(UTC),
    )
    service = SyllabusService(FakeRevisionSession(syllabus, message))

    result = await service.apply_revision(
        syllabus_id,
        SyllabusRevisionApplyRequest(
            summary="Memperjelas TLO",
            tlo="TLO baru",
            performance_result="Performance baru",
            condition_result="Condition baru",
            standard_result="Standard baru",
            elos=[ELO(elo="ELO baru")],
            journey=LearningJourney(
                pre_learning=LearningJourneyStage(
                    duration="45 menit",
                    method=["Metode pre baru"],
                    description="Pre baru",
                    content=["Pre baru"],
                ),
                classroom=LearningJourneyStage(
                    duration="2 hari",
                    method=["Metode class baru"],
                    description="Class baru",
                    content=["Class baru"],
                ),
                after_learning=LearningJourneyStage(
                    duration="2 minggu",
                    method=["Metode after baru"],
                    description="After baru",
                    content=["After baru"],
                ),
            ),
            reason="Menyesuaikan kebutuhan user",
            source_message_id=message_id,
        ),
    )

    assert result.tlo == "TLO baru"
    assert result.performance_result == "Performance baru"
    assert result.condition_result == "Condition baru"
    assert result.standard_result == "Standard baru"
    assert result.elos == [{"elo": "ELO baru"}]
    assert result.journey == {
        "pre_learning": {
            "duration": "45 menit",
            "method": ["Metode pre baru"],
            "description": "Pre baru",
            "content": ["Pre baru"],
        },
        "classroom": {
            "duration": "2 hari",
            "method": ["Metode class baru"],
            "description": "Class baru",
            "content": ["Class baru"],
        },
        "after_learning": {
            "duration": "2 minggu",
            "method": ["Metode after baru"],
            "description": "After baru",
            "content": ["After baru"],
        },
    }
    assert len(result.revision_history) == 1
    history_entry = result.revision_history[0]
    assert history_entry["tlo"] == "TLO lama"
    assert history_entry["summary"] == "Memperjelas TLO"
    assert history_entry["reason"] == "Menyesuaikan kebutuhan user"
    assert history_entry["source_message_id"] == str(message_id)
    assert history_entry["applied_fields"] == [
        "tlo",
        "performance_result",
        "condition_result",
        "standard_result",
        "elos",
        "journey",
    ]
    assert message.revision_applied is not None
    assert message.revision_applied["summary"] == "Memperjelas TLO"
    owner_history_rows = [obj for obj in service.db.added if isinstance(obj, OwnerHistory)]
    assert len(owner_history_rows) == 1
    assert owner_history_rows[0].action == "revised"
    assert owner_history_rows[0].revision_index == 1
