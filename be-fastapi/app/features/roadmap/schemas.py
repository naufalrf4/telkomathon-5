import uuid
from datetime import datetime
from typing import Any, cast

from pydantic import BaseModel, ConfigDict, Field

from app.features.personalize.schemas import CompetencyGap


class CareerRoadmapMilestone(BaseModel):
    phase_title: str
    timeframe: str
    objective: str
    focus_modules: list[str] = Field(default_factory=list)
    activities: list[str] = Field(default_factory=list)
    success_indicator: str


class CareerRoadmapRequest(BaseModel):
    participant_name: str
    current_role: str
    target_role: str
    time_horizon_weeks: int = Field(default=12, ge=1, le=104)
    competency_gaps: list[CompetencyGap]


class CareerRoadmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    participant_name: str
    current_role: str
    target_role: str
    time_horizon_weeks: int
    revision_index: int = 0
    competency_gaps: list[CompetencyGap]
    milestones: list[CareerRoadmapMilestone]
    created_at: datetime

    @classmethod
    def from_orm_coerce(cls, obj: object) -> "CareerRoadmapResponse":
        model = cast(Any, obj)
        raw_gaps = model.competency_gaps or []
        raw_milestones = model.milestones or []
        return cls.model_validate(
            {
                "id": model.id,
                "syllabus_id": model.syllabus_id,
                "participant_name": model.participant_name,
                "current_role": model.current_role,
                "target_role": model.target_role,
                "time_horizon_weeks": model.time_horizon_weeks,
                "revision_index": model.revision_index,
                "competency_gaps": [CompetencyGap(**gap) for gap in raw_gaps],
                "milestones": [CareerRoadmapMilestone(**item) for item in raw_milestones],
                "created_at": model.created_at,
            }
        )


class CareerRoadmapListResponse(BaseModel):
    syllabus_id: uuid.UUID
    total: int
    results: list[CareerRoadmapResponse]
