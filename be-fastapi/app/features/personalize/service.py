import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.personalize import build_personalize_prompt
from app.exceptions import AIServiceException, NotFoundException
from app.features.personalize.models import PersonalizationResult
from app.features.personalize.schemas import (
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
    ) -> PersonalizeResponse:
        result_row = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result_row.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))

        syllabus_dict: dict[str, object] = {
            "tlo": syllabus.tlo,
            "elos": syllabus.elos,
            "journey": syllabus.journey,
        }
        gaps_as_dicts = [g.model_dump() for g in request.competency_gaps]
        messages = build_personalize_prompt(syllabus_dict, gaps_as_dicts, "")

        raw = await chat_complete(messages)
        if not isinstance(raw, str):
            raise AIServiceException("Unexpected non-string response from LLM")

        try:
            parsed = json.loads(raw)
            raw_recs = parsed.get("recommendations", [])
        except (json.JSONDecodeError, AttributeError) as exc:
            raise AIServiceException(f"Failed to parse LLM response: {exc}") from exc

        recommendations = _normalize_recommendations(raw_recs)

        record = PersonalizationResult()
        record.syllabus_id = syllabus_id
        record.competency_gaps = gaps_as_dicts
        record.recommendations = [r.model_dump() for r in recommendations]
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return PersonalizeResponse.from_orm_coerce(record)

    async def get_personalization(self, syllabus_id: uuid.UUID) -> PersonalizeResponse:
        result_row = await self.db.execute(
            select(PersonalizationResult)
            .where(PersonalizationResult.syllabus_id == syllabus_id)
            .order_by(PersonalizationResult.created_at.desc())
        )
        record = result_row.scalar_one_or_none()
        if record is None:
            raise NotFoundException("PersonalizationResult", str(syllabus_id))
        return PersonalizeResponse.from_orm_coerce(record)


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
