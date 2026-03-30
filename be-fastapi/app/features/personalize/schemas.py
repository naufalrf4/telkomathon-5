import uuid
from datetime import datetime
from typing import Any, cast

from pydantic import BaseModel, ConfigDict


class CompetencyGap(BaseModel):
    skill: str
    current_level: int
    required_level: int
    gap_description: str


class LearningRecommendation(BaseModel):
    type: str
    title: str
    description: str
    estimated_duration_minutes: int
    priority: int


class PersonalizeRequest(BaseModel):
    participant_name: str
    competency_gaps: list[CompetencyGap]


class BulkParticipantRequest(BaseModel):
    participant_name: str
    competency_gaps: list[CompetencyGap]


class BulkPersonalizeRequest(BaseModel):
    participants: list[BulkParticipantRequest]


class PersonalizeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    bulk_session_id: uuid.UUID | None = None
    participant_name: str
    revision_index: int = 0
    competency_gaps: list[CompetencyGap]
    recommendations: list[LearningRecommendation]
    created_at: datetime

    @classmethod
    def from_orm_coerce(cls, obj: object) -> "PersonalizeResponse":
        model = cast(Any, obj)
        raw_gaps = model.competency_gaps or []
        raw_recs = model.recommendations or []
        return cls.model_validate(
            {
                "id": model.id,
                "syllabus_id": model.syllabus_id,
                "bulk_session_id": model.bulk_session_id,
                "participant_name": model.participant_name,
                "revision_index": model.revision_index,
                "competency_gaps": [CompetencyGap(**g) for g in raw_gaps],
                "recommendations": [LearningRecommendation(**r) for r in raw_recs],
                "created_at": model.created_at,
            }
        )


class BulkPersonalizeResponse(BaseModel):
    syllabus_id: uuid.UUID
    bulk_session_id: uuid.UUID
    total_participants: int
    results: list[PersonalizeResponse]


class BulkPersonalizationListResponse(BaseModel):
    syllabus_id: uuid.UUID
    total: int
    results: list[PersonalizeResponse]
