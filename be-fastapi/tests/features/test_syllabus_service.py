from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.features.chat.models import ChatMessage
from app.features.syllabus.models import GeneratedSyllabus
from app.features.syllabus.schemas import ELO, LearningJourney, SyllabusRevisionApplyRequest
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

    async def execute(self, statement: object) -> FakeScalarResult:
        statement_text = str(statement)
        if "chat_messages" in statement_text:
            return FakeScalarResult(self.message)
        return FakeScalarResult(self.syllabus)

    def add(self, _obj: object) -> None:
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
        elos=[{"elo": "ELO lama", "pce": ["A", "B"]}],
        journey={
            "pre_learning": ["Pre lama"],
            "classroom": ["Class lama"],
            "after_learning": ["After lama"],
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
            elos=[ELO(elo="ELO baru", pce=["C", "D"])],
            journey=LearningJourney(
                pre_learning=["Pre baru"],
                classroom=["Class baru"],
                after_learning=["After baru"],
            ),
            reason="Menyesuaikan kebutuhan user",
            source_message_id=message_id,
        ),
    )

    assert result.tlo == "TLO baru"
    assert result.elos == [{"elo": "ELO baru", "pce": ["C", "D"]}]
    assert result.journey == {
        "pre_learning": ["Pre baru"],
        "classroom": ["Class baru"],
        "after_learning": ["After baru"],
    }
    assert len(result.revision_history) == 1
    history_entry = result.revision_history[0]
    assert history_entry["tlo"] == "TLO lama"
    assert history_entry["summary"] == "Memperjelas TLO"
    assert history_entry["reason"] == "Menyesuaikan kebutuhan user"
    assert history_entry["source_message_id"] == str(message_id)
    assert history_entry["applied_fields"] == ["tlo", "elos", "journey"]
    assert message.revision_applied is not None
    assert message.revision_applied["summary"] == "Memperjelas TLO"
