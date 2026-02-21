import uuid
from datetime import datetime

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
    competency_gaps: list[CompetencyGap]


class PersonalizeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    competency_gaps: list[CompetencyGap]
    recommendations: list[LearningRecommendation]
    created_at: datetime

    @classmethod
    def from_orm_coerce(cls, obj: object) -> "PersonalizeResponse":
        raw_gaps = getattr(obj, "competency_gaps", [])
        raw_recs = getattr(obj, "recommendations", [])
        return cls.model_validate(
            {
                "id": getattr(obj, "id"),
                "syllabus_id": getattr(obj, "syllabus_id"),
                "competency_gaps": [CompetencyGap(**g) for g in raw_gaps],
                "recommendations": [LearningRecommendation(**r) for r in raw_recs],
                "created_at": getattr(obj, "created_at"),
            }
        )
