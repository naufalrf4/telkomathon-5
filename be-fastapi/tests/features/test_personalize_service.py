from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AIServiceException
from app.features.history.models import OwnerHistory
from app.features.personalize.models import PersonalizationResult
from app.features.personalize.schemas import (
    BulkParticipantRequest,
    BulkPersonalizeRequest,
    CompetencyGap,
    PersonalizeRequest,
)
from app.features.personalize.service import PersonalizeService
from app.features.syllabus.models import GeneratedSyllabus


class FakeScalarResult:
    def __init__(self, value: object):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakePersonalizeSession:
    def __init__(self, syllabus: GeneratedSyllabus):
        self.syllabus = syllabus
        self.added: list[object] = []

    async def execute(self, statement: object):
        return FakeScalarResult(self.syllabus)

    def add(self, obj: object):
        self.added.append(obj)

    async def flush(self):
        pass

    async def refresh(self, obj: object):
        target = cast(Any, obj)
        if getattr(target, "id", None) is None:
            target.id = uuid4()
        if getattr(target, "created_at", None) is None:
            target.created_at = datetime.now(UTC)


@pytest.mark.asyncio
async def test_personalize_falls_back_when_llm_unavailable(monkeypatch):
    syllabus_id = uuid4()
    syllabus = GeneratedSyllabus(
        id=syllabus_id,
        owner_id=uuid4(),
        topic="Machine Learning Level 1",
        target_level=1,
        course_category="Data",
        client_company_name="PT Demo",
        course_title="Machine Learning Level 1",
        company_profile_summary="Perusahaan berfokus pada transformasi analitik data.",
        commercial_overview="Program percepatan kapabilitas data.",
        tlo="Peserta mampu menjelaskan dasar machine learning untuk konteks kerja.",
        performance_result="Peserta dapat mengidentifikasi use case machine learning dasar.",
        condition_result="Diberikan studi kasus sederhana dan dataset awal.",
        standard_result="Identifikasi mencakup minimal tiga use case yang relevan.",
        elos=[
            {"elo": "Menjelaskan konsep AI, ML, dan DL."},
            {"elo": "Mengidentifikasi library Python untuk ML."},
        ],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "method": "Belajar mandiri",
                "description": "Orientasi konsep",
                "content": ["Konsep AI/ML/DL"],
            },
            "classroom": {
                "duration": "1 hari",
                "method": "Workshop",
                "description": "Sesi praktik terpandu",
                "content": ["Dasar Python", "EDA"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "method": "Tindak lanjut mandiri",
                "description": "Implementasi awal",
                "content": ["Review hasil"],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakePersonalizeSession(syllabus)

    async def fake_chat_complete(messages: object):
        raise AIServiceException("DeploymentNotFound")

    monkeypatch.setattr("app.features.personalize.service.chat_complete", fake_chat_complete)

    service = PersonalizeService(cast(AsyncSession, cast(object, db)))
    result = await service.analyze_and_recommend(
        syllabus_id,
        PersonalizeRequest(
            participant_name="Aulia Rahman",
            competency_gaps=[
                CompetencyGap(
                    skill="Python for ML",
                    current_level=1,
                    required_level=3,
                    gap_description="Belum konsisten membaca dataset dan menyiapkan notebook ML.",
                )
            ],
        ),
        owner_id=syllabus.owner_id,
    )

    assert result.participant_name == "Aulia Rahman"
    assert len(result.recommendations) == 1
    assert result.recommendations[0].title == "Penguatan Python for ML"
    assert "Aulia Rahman" in result.recommendations[0].description
    assert "Machine Learning Level 1" in result.recommendations[0].description

    personalization_rows = [obj for obj in db.added if isinstance(obj, PersonalizationResult)]
    history_rows = [obj for obj in db.added if isinstance(obj, OwnerHistory)]
    assert len(personalization_rows) == 1
    assert personalization_rows[0].revision_index == 0
    assert len(history_rows) == 1
    assert history_rows[0].action == "personalized"
    assert history_rows[0].revision_index == 0


@pytest.mark.asyncio
async def test_bulk_personalize_creates_grouped_results(monkeypatch):
    syllabus_id = uuid4()
    syllabus = GeneratedSyllabus(
        id=syllabus_id,
        owner_id=uuid4(),
        topic="Machine Learning Level 1",
        target_level=1,
        course_category="Data",
        client_company_name="PT Demo",
        course_title="Machine Learning Level 1",
        company_profile_summary="Perusahaan berfokus pada transformasi analitik data.",
        commercial_overview="Program percepatan kapabilitas data.",
        tlo="Peserta mampu menjelaskan dasar machine learning untuk konteks kerja.",
        performance_result="Peserta dapat mengidentifikasi use case machine learning dasar.",
        condition_result="Diberikan studi kasus sederhana dan dataset awal.",
        standard_result="Identifikasi mencakup minimal tiga use case yang relevan.",
        elos=[
            {"elo": "Menjelaskan konsep AI, ML, dan DL."},
            {"elo": "Mengidentifikasi library Python untuk ML."},
        ],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "method": "Belajar mandiri",
                "description": "Orientasi konsep",
                "content": ["Konsep AI/ML/DL"],
            },
            "classroom": {
                "duration": "1 hari",
                "method": "Workshop",
                "description": "Sesi praktik terpandu",
                "content": ["Dasar Python", "EDA"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "method": "Tindak lanjut mandiri",
                "description": "Implementasi awal",
                "content": ["Review hasil"],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakePersonalizeSession(syllabus)

    async def fake_chat_complete(messages: object):
        raise AIServiceException("DeploymentNotFound")

    monkeypatch.setattr("app.features.personalize.service.chat_complete", fake_chat_complete)

    service = PersonalizeService(cast(AsyncSession, cast(object, db)))
    result = await service.analyze_and_recommend_bulk(
        syllabus_id,
        BulkPersonalizeRequest(
            participants=[
                BulkParticipantRequest(
                    participant_name="Aulia Rahman",
                    competency_gaps=[
                        CompetencyGap(
                            skill="Python for ML",
                            current_level=1,
                            required_level=3,
                            gap_description="Belum konsisten membaca dataset",
                        )
                    ],
                ),
                BulkParticipantRequest(
                    participant_name="Bima Saputra",
                    competency_gaps=[
                        CompetencyGap(
                            skill="EDA",
                            current_level=1,
                            required_level=2,
                            gap_description="Masih kesulitan merangkum insight",
                        )
                    ],
                ),
            ]
        ),
        owner_id=syllabus.owner_id,
    )

    assert result.total_participants == 2
    assert len(result.results) == 2
    assert result.results[0].bulk_session_id is not None
    assert result.results[0].bulk_session_id == result.results[1].bulk_session_id

    personalization_rows = [obj for obj in db.added if isinstance(obj, PersonalizationResult)]
    history_rows = [obj for obj in db.added if isinstance(obj, OwnerHistory)]
    assert len(personalization_rows) == 2
    assert all(
        row.bulk_session_id == personalization_rows[0].bulk_session_id
        for row in personalization_rows
    )
    assert len(history_rows) == 1
    assert history_rows[0].action == "bulk_personalized"
