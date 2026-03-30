import json
import uuid
from collections.abc import Sequence
from typing import Any, cast

from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.personalize import build_personalize_prompt
from app.exceptions import AIServiceException, NotFoundException
from app.features.history.models import OwnerHistory
from app.features.personalize.models import PersonalizationResult
from app.features.personalize.schemas import (
    BulkPersonalizeRequest,
    BulkPersonalizeResponse,
    LearningRecommendation,
    PersonalizeRequest,
    PersonalizeResponse,
)
from app.features.syllabus.models import GeneratedSyllabus


class PersonalizeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def analyze_and_recommend(
        self,
        syllabus_id: uuid.UUID,
        request: PersonalizeRequest,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> PersonalizeResponse:
        syllabus = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        current_revision_index = len(syllabus.revision_history or [])
        record = await self._create_personalization_record(
            syllabus=syllabus,
            participant_name=request.participant_name.strip(),
            competency_gaps=[g.model_dump() for g in request.competency_gaps],
            revision_index=current_revision_index,
        )

        history_entry = OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id) if owner_id is not None else "default",
            action="personalized",
            summary=f"Generated recommendation plan for {record.participant_name}",
            detail={
                "participant_name": record.participant_name,
                "revision_index": current_revision_index,
                "gap_count": len(record.competency_gaps),
                "recommendation_count": len(record.recommendations),
            },
            revision_index=current_revision_index,
        )
        self.db.add(history_entry)
        return PersonalizeResponse.from_orm_coerce(record)

    async def analyze_and_recommend_bulk(
        self,
        syllabus_id: uuid.UUID,
        request: BulkPersonalizeRequest,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> BulkPersonalizeResponse:
        syllabus = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        current_revision_index = len(syllabus.revision_history or [])

        participants = [item for item in request.participants if item.participant_name.strip()]
        if not participants:
            raise NotFoundException("BulkPersonalizeRequest", "participants")

        bulk_session_id = uuid.uuid4()
        results: list[PersonalizeResponse] = []
        for participant in participants:
            record = await self._create_personalization_record(
                syllabus=syllabus,
                participant_name=participant.participant_name.strip(),
                competency_gaps=[gap.model_dump() for gap in participant.competency_gaps],
                revision_index=current_revision_index,
                bulk_session_id=bulk_session_id,
            )
            results.append(PersonalizeResponse.from_orm_coerce(record))

        history_entry = OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id) if owner_id is not None else "default",
            action="bulk_personalized",
            summary=f"Generated bulk recommendation plan for {len(results)} participants",
            detail={
                "bulk_session_id": str(bulk_session_id),
                "participant_count": len(results),
                "participant_names": [result.participant_name for result in results],
                "revision_index": current_revision_index,
            },
            revision_index=current_revision_index,
        )
        self.db.add(history_entry)

        return BulkPersonalizeResponse(
            syllabus_id=syllabus_id,
            bulk_session_id=bulk_session_id,
            total_participants=len(results),
            results=results,
        )

    async def get_personalization(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> PersonalizeResponse | None:
        _ = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        result_row = await self.db.execute(
            select(PersonalizationResult)
            .where(PersonalizationResult.syllabus_id == syllabus_id)
            .where(PersonalizationResult.bulk_session_id.is_(None))
            .order_by(PersonalizationResult.created_at.desc())
        )
        record = result_row.scalars().first()
        if record is None:
            return None
        return PersonalizeResponse.from_orm_coerce(record)

    async def get_bulk_personalizations(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> list[PersonalizeResponse]:
        _ = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        result_row = await self.db.execute(
            select(PersonalizationResult)
            .where(
                PersonalizationResult.syllabus_id == syllabus_id,
                PersonalizationResult.bulk_session_id.is_not(None),
            )
            .order_by(PersonalizationResult.created_at.desc())
        )
        records = list(result_row.scalars().all())
        return [PersonalizeResponse.from_orm_coerce(record) for record in records]

    async def _get_owned_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        if owner_id is not None:
            stmt = stmt.where(GeneratedSyllabus.owner_id == owner_id)
        result_row = await self.db.execute(stmt)
        syllabus = result_row.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return syllabus

    async def _generate_recommendations(
        self,
        *,
        messages: Sequence[ChatCompletionMessageParam],
        participant_name: str,
        competency_gaps: list[dict[str, object]],
        syllabus: GeneratedSyllabus,
    ) -> list[LearningRecommendation]:
        try:
            raw = await chat_complete(list(messages))
            if not isinstance(raw, str):
                raise AIServiceException("Unexpected non-string response from LLM")
            parsed = cast(dict[str, Any], json.loads(raw))
            raw_recs = parsed.get("recommendations", [])
            recommendations = _normalize_recommendations(raw_recs)
            if recommendations:
                return recommendations
        except (AIServiceException, json.JSONDecodeError, AttributeError, TypeError, ValueError):
            pass

        return _fallback_recommendations(
            participant_name=participant_name,
            competency_gaps=competency_gaps,
            syllabus=syllabus,
        )

    async def _create_personalization_record(
        self,
        *,
        syllabus: GeneratedSyllabus,
        participant_name: str,
        competency_gaps: list[dict[str, object]],
        revision_index: int,
        bulk_session_id: uuid.UUID | None = None,
    ) -> PersonalizationResult:
        syllabus_dict: dict[str, object] = {
            "tlo": syllabus.tlo,
            "elos": syllabus.elos,
            "journey": syllabus.journey,
        }
        messages = build_personalize_prompt(
            syllabus_dict,
            competency_gaps,
            "",
            participant_name,
        )
        recommendations = await self._generate_recommendations(
            messages=messages,
            participant_name=participant_name,
            competency_gaps=competency_gaps,
            syllabus=syllabus,
        )

        record = PersonalizationResult()
        record.syllabus_id = syllabus.id
        record.bulk_session_id = bulk_session_id
        record.participant_name = participant_name
        record.revision_index = revision_index
        record.competency_gaps = competency_gaps
        record.recommendations = [recommendation.model_dump() for recommendation in recommendations]
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record


def _normalize_recommendations(raw: list[object]) -> list[LearningRecommendation]:
    result: list[LearningRecommendation] = []
    priority_counter = 1
    for item in raw:
        if not isinstance(item, dict):
            continue
        modules = item.get("modules", [])
        if isinstance(modules, list):
            for mod in modules:
                if not isinstance(mod, dict):
                    continue
                result.append(
                    LearningRecommendation(
                        type=str(mod.get("type", "additional")),
                        title=str(mod.get("title", "")),
                        description=str(mod.get("description", "")),
                        estimated_duration_minutes=int(mod.get("duration_min", 30)),
                        priority=min(priority_counter, 3),
                    )
                )
                priority_counter += 1
        else:
            result.append(
                LearningRecommendation(
                    type=str(item.get("type", "additional")),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    estimated_duration_minutes=int(item.get("estimated_duration_minutes", 30)),
                    priority=min(int(item.get("priority", priority_counter)), 3),
                )
            )
            priority_counter += 1
    return result


def _fallback_recommendations(
    *,
    participant_name: str,
    competency_gaps: list[dict[str, object]],
    syllabus: GeneratedSyllabus,
) -> list[LearningRecommendation]:
    topic = (syllabus.course_title or syllabus.topic or "silabus final").strip()
    learning_focus = _derive_learning_focus(syllabus.elos)
    participant_label = participant_name.strip() or "peserta"

    recommendations: list[LearningRecommendation] = []
    for index, gap in enumerate(competency_gaps, start=1):
        skill = str(gap.get("skill", "Kompetensi inti")).strip() or "Kompetensi inti"
        current_level = _to_int(gap.get("current_level"), default=0)
        required_level = _to_int(gap.get("required_level"), default=current_level + 1)
        gap_description = str(gap.get("gap_description", "")).strip()

        description_parts = [
            f"Rekomendasi fallback untuk {participant_label} agar meningkatkan kompetensi {skill} pada konteks {topic}.",
            f"Fokus belajar: {learning_focus}.",
            f"Target peningkatan level {current_level} ke {required_level} melalui penguatan konsep inti, demonstrasi, dan latihan terarah.",
        ]
        if gap_description:
            description_parts.append(f"Gap utama: {gap_description}.")

        recommendations.append(
            LearningRecommendation(
                type=_fallback_type(index),
                title=f"Penguatan {skill}",
                description=" ".join(description_parts),
                estimated_duration_minutes=_fallback_duration(current_level, required_level, index),
                priority=min(index, 3),
            )
        )

    if recommendations:
        return recommendations

    return [
        LearningRecommendation(
            type="guided-practice",
            title=f"Penguatan kompetensi untuk {participant_label}",
            description=(
                f"Fallback recommendation untuk {topic}. Fokus belajar: {learning_focus}. "
                "Susun sesi penguatan konsep inti, demonstrasi terarah, dan latihan mandiri yang relevan dengan kebutuhan kerja."
            ),
            estimated_duration_minutes=45,
            priority=1,
        )
    ]


def _derive_learning_focus(raw_elos: object) -> str:
    if not isinstance(raw_elos, Sequence) or isinstance(raw_elos, str | bytes):
        return "penguatan kompetensi inti"

    focus_items: list[str] = []
    for item in raw_elos:
        if not isinstance(item, dict):
            continue
        elo = str(item.get("elo", "")).strip()
        if elo:
            focus_items.append(elo.rstrip("."))
        if len(focus_items) == 3:
            break
    if not focus_items:
        return "penguatan kompetensi inti"
    return "; ".join(focus_items)


def _fallback_type(index: int) -> str:
    fallback_types = ["guided-practice", "microlearning", "applied-review"]
    return fallback_types[(index - 1) % len(fallback_types)]


def _fallback_duration(current_level: int, required_level: int, index: int) -> int:
    gap = max(required_level - current_level, 1)
    return min(30 + gap * 15 + (index - 1) * 10, 120)


def _to_int(value: object, *, default: int) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default
