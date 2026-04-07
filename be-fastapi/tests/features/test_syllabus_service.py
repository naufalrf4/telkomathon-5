from datetime import UTC, datetime
from uuid import uuid4

import pytest

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
    def __init__(self, syllabus: GeneratedSyllabus) -> None:
        self.syllabus: GeneratedSyllabus = syllabus
        self.added: list[object] = []

    async def execute(self, statement: object) -> FakeScalarResult:
        _ = statement
        return FakeScalarResult(self.syllabus)

    def add(self, _obj: object) -> None:
        self.added.append(_obj)
        return None

    async def flush(self) -> None:
        return None

    async def refresh(self, _obj: object) -> None:
        return None


@pytest.mark.asyncio
async def test_apply_revision_updates_revision_history() -> None:
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
    service = SyllabusService(FakeRevisionSession(syllabus))

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
    assert service.db.added == []
    assert syllabus.generation_meta == {
        "tlo": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
        "performance_result": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
        "condition_result": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
        "standard_result": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
        "elos": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
        "journey": {
            "source": "revision_chat",
            "prompt_version": None,
            "grounded_with": ["revision_request"],
            "source_message_id": str(message_id),
        },
    }


@pytest.mark.asyncio
async def test_create_finalized_syllabus_persists_ai_journey_and_generation_meta() -> None:
    db = FakeRevisionSession(
        GeneratedSyllabus(
            id=uuid4(),
            topic="placeholder",
            target_level=1,
            course_category=None,
            client_company_name=None,
            course_title=None,
            company_profile_summary=None,
            commercial_overview=None,
            tlo="placeholder",
            performance_result=None,
            condition_result=None,
            standard_result=None,
            elos=[{"elo": "placeholder"}],
            journey={
                "pre_learning": {"duration": "", "method": [], "description": "", "content": []},
                "classroom": {"duration": "", "method": [], "description": "", "content": []},
                "after_learning": {"duration": "", "method": [], "description": "", "content": []},
            },
            source_doc_ids=[],
            revision_history=[],
            status="draft",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    service = SyllabusService(db)

    result = await service.create_finalized_syllabus(
        topic="Data Analytics",
        target_level=3,
        course_category="Technical",
        client_company_name="PT Demo",
        course_title="Data Analytics Bootcamp",
        company_profile_summary="Ringkasan perusahaan",
        commercial_overview="Program analitik data untuk tim operasional.",
        tlo="Peserta mampu membaca data operasional dan menyusun insight kerja.",
        performance_result="Menyusun insight dari dashboard operasional.",
        condition_result="Menggunakan studi kasus dan dashboard operasional yang relevan.",
        standard_result="Insight yang dihasilkan akurat, jelas, dan dapat ditindaklanjuti.",
        elos=[{"elo": "Mengidentifikasi metrik utama"}],
        journey={
            "pre_learning": {
                "duration": "60 menit",
                "method": ["Belajar mandiri"],
                "description": "Orientasi awal",
                "content": ["Pengantar analitik data"],
            },
            "classroom": {
                "duration": "240 menit",
                "method": ["Workshop"],
                "description": "Latihan inti",
                "content": ["Membaca dashboard", "Menyusun insight"],
            },
            "after_learning": {
                "duration": "120 menit",
                "method": ["Tugas penerapan"],
                "description": "Tindak lanjut",
                "content": ["Rencana aksi"],
            },
        },
        source_doc_ids=[str(uuid4())],
        generation_meta={
            "condition_result": {"source": "ai_final_synthesis"},
            "journey": {"source": "ai_final_synthesis"},
        },
    )

    assert result.journey == {
        "pre_learning": {
            "duration": "60 menit",
            "method": ["Belajar mandiri"],
            "description": "Orientasi awal",
            "content": ["Pengantar analitik data"],
        },
        "classroom": {
            "duration": "240 menit",
            "method": ["Workshop"],
            "description": "Latihan inti",
            "content": ["Membaca dashboard", "Menyusun insight"],
        },
        "after_learning": {
            "duration": "120 menit",
            "method": ["Tugas penerapan"],
            "description": "Tindak lanjut",
            "content": ["Rencana aksi"],
        },
    }
    assert result.generation_meta == {
        "condition_result": {"source": "ai_final_synthesis"},
        "journey": {"source": "ai_final_synthesis"},
    }
