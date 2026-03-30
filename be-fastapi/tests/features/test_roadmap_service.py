from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AIServiceException
from app.features.history.models import OwnerHistory
from app.features.personalize.schemas import CompetencyGap
from app.features.roadmap.models import CareerRoadmapResult
from app.features.roadmap.schemas import CareerRoadmapRequest
from app.features.roadmap.service import CareerRoadmapService
from app.features.syllabus.models import GeneratedSyllabus


class FakeScalarResult:
    def __init__(self, value: object):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        if isinstance(self.value, list):
            return self.value
        return [self.value] if self.value is not None else []


class FakeRoadmapSession:
    def __init__(self, syllabus: GeneratedSyllabus):
        self.syllabus = syllabus
        self.added: list[object] = []

    async def execute(self, statement: object):
        statement_text = str(statement)
        if "career_roadmap_results" in statement_text:
            rows = [obj for obj in self.added if isinstance(obj, CareerRoadmapResult)]
            return FakeScalarResult(rows)
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
async def test_create_roadmap_falls_back_and_records_history(monkeypatch):
    syllabus_id = uuid4()
    syllabus = GeneratedSyllabus(
        id=syllabus_id,
        owner_id=uuid4(),
        topic="Machine Learning Level 1",
        target_level=1,
        course_category="Digital Literacy & Awareness",
        client_company_name="PT Demo",
        course_title="Machine Learning Level 1",
        company_profile_summary="Perusahaan fokus pada penguatan kapabilitas analitik data.",
        commercial_overview="Program peningkatan literasi data untuk tim operasional.",
        tlo="Peserta mampu mengidentifikasi dasar machine learning pada konteks kerja.",
        performance_result="Peserta mampu mengidentifikasi use case machine learning sederhana.",
        condition_result="Diberikan studi kasus dasar dan data contoh.",
        standard_result="Identifikasi mencakup tiga use case yang relevan.",
        elos=[
            {"elo": "Menjelaskan konsep AI, ML, dan DL."},
            {"elo": "Mengidentifikasi library Python untuk ML."},
        ],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "method": ["Belajar mandiri"],
                "description": "Orientasi",
                "content": ["Konsep AI/ML/DL"],
            },
            "classroom": {
                "duration": "1 hari",
                "method": ["Workshop"],
                "description": "Praktik",
                "content": ["Python dasar", "EDA"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "method": ["Tindak lanjut"],
                "description": "Implementasi",
                "content": ["Rencana aksi"],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeRoadmapSession(syllabus)

    async def fake_chat_complete(messages: object):
        raise AIServiceException("DeploymentNotFound")

    monkeypatch.setattr("app.features.roadmap.service.chat_complete", fake_chat_complete)

    service = CareerRoadmapService(cast(AsyncSession, cast(object, db)))
    result = await service.create_roadmap(
        syllabus_id,
        CareerRoadmapRequest(
            participant_name="Aulia Rahman",
            current_role="Junior Analyst",
            target_role="ML Analyst",
            time_horizon_weeks=12,
            competency_gaps=[
                CompetencyGap(
                    skill="Python for ML",
                    current_level=1,
                    required_level=3,
                    gap_description="Belum konsisten membaca dataset dan menyusun workflow ML.",
                )
            ],
        ),
        owner_id=syllabus.owner_id,
    )

    assert result.participant_name == "Aulia Rahman"
    assert result.target_role == "ML Analyst"
    assert len(result.milestones) == 3
    assert result.milestones[0].phase_title.startswith("Fase 1")

    roadmap_rows = [obj for obj in db.added if isinstance(obj, CareerRoadmapResult)]
    history_rows = [obj for obj in db.added if isinstance(obj, OwnerHistory)]
    assert len(roadmap_rows) == 1
    assert len(history_rows) == 1
    assert history_rows[0].action == "roadmapped"


@pytest.mark.asyncio
async def test_list_roadmaps_returns_latest_first():
    syllabus_id = uuid4()
    syllabus = GeneratedSyllabus(
        id=syllabus_id,
        owner_id=uuid4(),
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
        elos=[{"elo": "ELO-1"}],
        journey={
            "pre_learning": {
                "duration": "60 menit",
                "method": ["Belajar mandiri"],
                "description": "Pra-pembelajaran",
                "content": ["Ringkasan materi"],
            },
            "classroom": {
                "duration": "240 menit",
                "method": ["Workshop"],
                "description": "Sesi kelas",
                "content": ["Latihan"],
            },
            "after_learning": {
                "duration": "120 menit",
                "method": ["Review"],
                "description": "Pasca-pembelajaran",
                "content": ["Tindak lanjut"],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeRoadmapSession(syllabus)
    newer = CareerRoadmapResult(
        id=uuid4(),
        syllabus_id=syllabus_id,
        participant_name="Bima Saputra",
        current_role="Analyst",
        target_role="Senior Analyst",
        time_horizon_weeks=8,
        revision_index=0,
        competency_gaps=[],
        milestones=[],
        created_at=datetime(2026, 3, 30, tzinfo=UTC),
    )
    older = CareerRoadmapResult(
        id=uuid4(),
        syllabus_id=syllabus_id,
        participant_name="Aulia Rahman",
        current_role="Junior Analyst",
        target_role="ML Analyst",
        time_horizon_weeks=12,
        revision_index=0,
        competency_gaps=[],
        milestones=[],
        created_at=datetime(2026, 3, 29, tzinfo=UTC),
    )
    db.added.extend([newer, older])

    service = CareerRoadmapService(cast(AsyncSession, cast(object, db)))
    results = await service.list_roadmaps(syllabus_id, owner_id=syllabus.owner_id)

    assert len(results) == 2
    assert results[0].participant_name == "Bima Saputra"
    assert results[1].participant_name == "Aulia Rahman"
