import json
import logging
import uuid
from collections.abc import Sequence
from typing import Any, cast

from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.personalize import build_personalize_prompt
from app.exceptions import AIServiceException, NotFoundException
from app.features.personalize.models import PersonalizationResult
from app.features.personalize.schemas import (
    BulkPersonalizeRequest,
    BulkPersonalizeResponse,
    LearningRecommendation,
    PersonalizeRequest,
    PersonalizeResponse,
)
from app.features.syllabus.models import GeneratedSyllabus

logger = logging.getLogger(__name__)


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
        raw = await chat_complete(list(messages))
        if not isinstance(raw, str):
            raise AIServiceException("Unexpected non-string response from LLM")

        try:
            parsed = cast(dict[str, Any], json.loads(raw))
        except json.JSONDecodeError as exc:
            raise AIServiceException("Personalization response was not valid JSON") from exc

        raw_recs = parsed.get("recommendations", [])
        recommendations = _normalize_recommendations(raw_recs)
        if not recommendations:
            raise AIServiceException(
                "Personalization response did not contain valid recommendations"
            )
        return recommendations

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
        available_content = self._build_available_content(syllabus)
        messages = build_personalize_prompt(
            syllabus_dict,
            competency_gaps,
            available_content,
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

    def _build_available_content(self, syllabus: GeneratedSyllabus) -> str:
        sections: list[str] = []

        if syllabus.company_profile_summary:
            sections.append(f"Company Profile Summary: {syllabus.company_profile_summary}")
        if syllabus.commercial_overview:
            sections.append(f"Business Context: {syllabus.commercial_overview}")
        if syllabus.performance_result:
            sections.append(f"Performance Result: {syllabus.performance_result}")
        if syllabus.condition_result:
            sections.append(f"Condition Result: {syllabus.condition_result}")
        if syllabus.standard_result:
            sections.append(f"Standard Result: {syllabus.standard_result}")

        elo_lines = [
            str(item.get("elo", "")).strip()
            for item in syllabus.elos
            if isinstance(item, dict) and str(item.get("elo", "")).strip()
        ]
        if elo_lines:
            sections.append("ELOs:\n- " + "\n- ".join(elo_lines))

        journey = syllabus.journey if isinstance(syllabus.journey, dict) else {}
        journey_sections: list[str] = []
        for label, key in (
            ("Pre-learning", "pre_learning"),
            ("Classroom", "classroom"),
            ("After-learning", "after_learning"),
        ):
            stage = journey.get(key)
            if not isinstance(stage, dict):
                continue
            description = str(stage.get("description", "")).strip()
            content = stage.get("content")
            content_lines = (
                [
                    str(item).strip()
                    for item in content
                    if isinstance(item, str) and str(item).strip()
                ]
                if isinstance(content, list)
                else []
            )
            parts = [part for part in [description, "; ".join(content_lines)] if part]
            if parts:
                journey_sections.append(f"{label}: {' | '.join(parts)}")
        if journey_sections:
            sections.append("Learning Journey:\n" + "\n".join(journey_sections))

        return "\n\n".join(sections)


def _normalize_recommendations(raw: list[object]) -> list[LearningRecommendation]:
    result: list[LearningRecommendation] = []
    priority_counter = 1
    for item in raw:
        if not isinstance(item, dict):
            continue
        modules = item.get("modules")
        if isinstance(modules, list) and modules:
            for mod in modules:
                if not isinstance(mod, dict):
                    continue
                title = str(mod.get("title", "")).strip()
                description = str(mod.get("description", "")).strip()
                if not title or not description:
                    continue
                duration = _normalize_positive_int(mod.get("duration_min"), default=30)
                result.append(
                    LearningRecommendation(
                        type=str(mod.get("type", "additional")),
                        title=title,
                        description=description,
                        estimated_duration_minutes=duration,
                        priority=min(priority_counter, 3),
                    )
                )
                priority_counter += 1
        else:
            title = str(item.get("title", "")).strip()
            description = str(item.get("description", "")).strip()
            if not title or not description:
                continue
            duration = _normalize_positive_int(item.get("estimated_duration_minutes"), default=30)
            priority = _normalize_priority(item.get("priority"), default=priority_counter)
            result.append(
                LearningRecommendation(
                    type=str(item.get("type", "additional")),
                    title=title,
                    description=description,
                    estimated_duration_minutes=duration,
                    priority=priority,
                )
            )
            priority_counter += 1
    return result


def _normalize_positive_int(value: object, *, default: int) -> int:
    if value is None:
        return default

    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        logger.warning("Invalid numeric recommendation value", extra={"value": value})
        return default

    return parsed if parsed > 0 else default


def _normalize_priority(value: object, *, default: int) -> int:
    normalized = _normalize_positive_int(value, default=default)
    return min(normalized, 3)
