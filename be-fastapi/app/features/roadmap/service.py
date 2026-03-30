import json
import uuid
from collections.abc import Sequence
from typing import Any, cast

from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.roadmap import build_roadmap_prompt
from app.exceptions import AIServiceException, NotFoundException
from app.features.history.models import OwnerHistory
from app.features.roadmap.models import CareerRoadmapResult
from app.features.roadmap.schemas import (
    CareerRoadmapMilestone,
    CareerRoadmapRequest,
    CareerRoadmapResponse,
)
from app.features.syllabus.models import GeneratedSyllabus


class CareerRoadmapService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_roadmap(
        self,
        syllabus_id: uuid.UUID,
        request: CareerRoadmapRequest,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> CareerRoadmapResponse:
        syllabus = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        current_revision_index = len(syllabus.revision_history or [])
        record = await self._create_roadmap_record(
            syllabus=syllabus,
            participant_name=request.participant_name.strip(),
            current_role=request.current_role.strip(),
            target_role=request.target_role.strip(),
            time_horizon_weeks=request.time_horizon_weeks,
            competency_gaps=[gap.model_dump() for gap in request.competency_gaps],
            revision_index=current_revision_index,
        )

        history_entry = OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id) if owner_id is not None else "default",
            action="roadmapped",
            summary=f"Generated career roadmap for {record.participant_name}",
            detail={
                "participant_name": record.participant_name,
                "current_role": record.current_role,
                "target_role": record.target_role,
                "revision_index": current_revision_index,
                "milestone_count": len(record.milestones),
            },
            revision_index=current_revision_index,
        )
        self.db.add(history_entry)
        return CareerRoadmapResponse.from_orm_coerce(record)

    async def list_roadmaps(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> list[CareerRoadmapResponse]:
        _ = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        result = await self.db.execute(
            select(CareerRoadmapResult)
            .where(CareerRoadmapResult.syllabus_id == syllabus_id)
            .order_by(CareerRoadmapResult.created_at.desc())
        )
        return [CareerRoadmapResponse.from_orm_coerce(row) for row in result.scalars().all()]

    async def _get_owned_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        if owner_id is not None:
            stmt = stmt.where(GeneratedSyllabus.owner_id == owner_id)
        result = await self.db.execute(stmt)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return syllabus

    async def _create_roadmap_record(
        self,
        *,
        syllabus: GeneratedSyllabus,
        participant_name: str,
        current_role: str,
        target_role: str,
        time_horizon_weeks: int,
        competency_gaps: list[dict[str, object]],
        revision_index: int,
    ) -> CareerRoadmapResult:
        syllabus_dict: dict[str, object] = {
            "topic": syllabus.topic,
            "course_title": syllabus.course_title or syllabus.topic,
            "target_level": syllabus.target_level,
            "tlo": syllabus.tlo,
            "elos": syllabus.elos,
            "journey": syllabus.journey,
        }
        messages = build_roadmap_prompt(
            syllabus_context=syllabus_dict,
            participant_name=participant_name,
            current_role=current_role,
            target_role=target_role,
            time_horizon_weeks=time_horizon_weeks,
            competency_gaps=competency_gaps,
        )
        milestones = await self._generate_milestones(
            messages=messages,
            participant_name=participant_name,
            current_role=current_role,
            target_role=target_role,
            time_horizon_weeks=time_horizon_weeks,
            competency_gaps=competency_gaps,
            syllabus=syllabus,
        )

        record = CareerRoadmapResult(
            syllabus_id=syllabus.id,
            participant_name=participant_name,
            current_role=current_role,
            target_role=target_role,
            time_horizon_weeks=time_horizon_weeks,
            revision_index=revision_index,
            competency_gaps=competency_gaps,
            milestones=[milestone.model_dump() for milestone in milestones],
        )
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record

    async def _generate_milestones(
        self,
        *,
        messages: Sequence[ChatCompletionMessageParam],
        participant_name: str,
        current_role: str,
        target_role: str,
        time_horizon_weeks: int,
        competency_gaps: list[dict[str, object]],
        syllabus: GeneratedSyllabus,
    ) -> list[CareerRoadmapMilestone]:
        try:
            raw = await chat_complete(list(messages))
            if not isinstance(raw, str):
                raise AIServiceException("Unexpected non-string response from LLM")
            parsed = cast(dict[str, Any], json.loads(raw))
            milestones = _normalize_milestones(parsed.get("milestones", []))
            if milestones:
                return milestones
        except (AIServiceException, json.JSONDecodeError, AttributeError, TypeError, ValueError):
            pass

        return _fallback_milestones(
            participant_name=participant_name,
            current_role=current_role,
            target_role=target_role,
            time_horizon_weeks=time_horizon_weeks,
            competency_gaps=competency_gaps,
            syllabus=syllabus,
        )


def _normalize_milestones(raw: object) -> list[CareerRoadmapMilestone]:
    if not isinstance(raw, list):
        return []
    milestones: list[CareerRoadmapMilestone] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        phase_title = str(item.get("phase_title", "")).strip()
        timeframe = str(item.get("timeframe", "")).strip()
        objective = str(item.get("objective", "")).strip()
        success_indicator = str(item.get("success_indicator", "")).strip()
        focus_modules = [
            str(value).strip()
            for value in item.get("focus_modules", [])
            if isinstance(value, str) and str(value).strip()
        ]
        activities = [
            str(value).strip()
            for value in item.get("activities", [])
            if isinstance(value, str) and str(value).strip()
        ]
        if not (phase_title and timeframe and objective and success_indicator):
            continue
        milestones.append(
            CareerRoadmapMilestone(
                phase_title=phase_title,
                timeframe=timeframe,
                objective=objective,
                focus_modules=focus_modules,
                activities=activities,
                success_indicator=success_indicator,
            )
        )
    return milestones


def _fallback_milestones(
    *,
    participant_name: str,
    current_role: str,
    target_role: str,
    time_horizon_weeks: int,
    competency_gaps: list[dict[str, object]],
    syllabus: GeneratedSyllabus,
) -> list[CareerRoadmapMilestone]:
    course_name = (syllabus.course_title or syllabus.topic or "program belajar").strip()
    focus_modules = [
        str(item.get("elo", "")).strip().rstrip(".")
        for item in syllabus.elos or []
        if isinstance(item, dict) and str(item.get("elo", "")).strip()
    ][:4]
    if not focus_modules:
        focus_modules = [course_name]

    first_gap = (
        str(competency_gaps[0].get("skill", "Kompetensi inti")).strip()
        if competency_gaps
        else "Kompetensi inti"
    )
    second_gap = (
        str(competency_gaps[1].get("skill", first_gap)).strip()
        if len(competency_gaps) > 1
        else first_gap
    )

    weeks = max(time_horizon_weeks, 6)
    phase_one_end = max(2, weeks // 3)
    phase_two_end = max(phase_one_end + 2, (weeks * 2) // 3)

    return [
        CareerRoadmapMilestone(
            phase_title="Fase 1 · Bangun Fondasi",
            timeframe=f"Minggu 1-{phase_one_end}",
            objective=f"{participant_name or 'Peserta'} menguatkan dasar {first_gap} untuk transisi dari {current_role or 'peran saat ini'}.",
            focus_modules=focus_modules[:2] or focus_modules,
            activities=[
                f"Pelajari kembali modul inti {course_name} dan catat konsep yang paling relevan dengan peran {target_role or 'tujuan karier'}.",
                f"Kerjakan latihan terstruktur untuk gap {first_gap} dengan contoh kasus kerja nyata.",
            ],
            success_indicator=f"Peserta mampu menjelaskan dasar {first_gap} dan menunjukkan penerapan awal pada konteks kerja.",
        ),
        CareerRoadmapMilestone(
            phase_title="Fase 2 · Praktik Terarah",
            timeframe=f"Minggu {phase_one_end + 1}-{phase_two_end}",
            objective=f"Peserta menerapkan keterampilan {second_gap} dalam simulasi atau tugas terarah yang mendekati tuntutan {target_role or 'peran target'}.",
            focus_modules=focus_modules[1:4] or focus_modules,
            activities=[
                "Ikuti sesi praktik atau proyek mini dengan target keluaran yang jelas.",
                "Minta umpan balik berkala dari mentor/atasan untuk memperbaiki kualitas hasil kerja.",
            ],
            success_indicator="Peserta menghasilkan artefak kerja sederhana yang memenuhi standar awal tim atau fungsi target.",
        ),
        CareerRoadmapMilestone(
            phase_title="Fase 3 · Siap Transisi",
            timeframe=f"Minggu {phase_two_end + 1}-{weeks}",
            objective=f"Peserta menyusun portofolio hasil belajar dan rencana aksi untuk mendukung transisi menuju {target_role or 'peran target'}.",
            focus_modules=focus_modules,
            activities=[
                "Dokumentasikan hasil belajar, tantangan, dan peningkatan kompetensi utama.",
                f"Susun rencana penguatan lanjutan yang relevan dengan ekspektasi {target_role or 'peran target'}.",
            ],
            success_indicator="Peserta memiliki bukti kemajuan, umpan balik terdokumentasi, dan rencana aksi transisi yang dapat ditinjau atasan.",
        ),
    ]
