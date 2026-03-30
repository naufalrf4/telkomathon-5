import uuid
from datetime import datetime
from typing import Any, cast

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Owner History
# ---------------------------------------------------------------------------


class OwnerHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    owner_id: str
    action: str
    summary: str
    detail: dict[str, object]
    revision_index: int | None = None
    created_at: datetime


class OwnerHistoryListResponse(BaseModel):
    items: list[OwnerHistoryResponse]
    total: int


class OwnerHistoryAggregation(BaseModel):
    """Rollup counts per action kind for an owner across all syllabi or one."""

    owner_id: str
    syllabus_id: uuid.UUID | None = None
    action_counts: dict[str, int]
    first_event: datetime | None = None
    last_event: datetime | None = None
    total_events: int = 0


class RevisionSnapshot(BaseModel):
    revision_index: int
    tlo: str
    performance_result: str = ""
    condition_result: str = ""
    standard_result: str = ""
    elos: list[str] = Field(default_factory=list)
    journey_summary: dict[str, list[str]] = Field(default_factory=dict)


class RevisionDownstreamSummary(BaseModel):
    personalization_count: int = 0
    participant_names: list[str] = Field(default_factory=list)
    export_count: int = 0
    module_generation_count: int = 0
    latest_personalized_at: datetime | None = None
    latest_exported_at: datetime | None = None
    latest_decomposed_at: datetime | None = None


class RevisionNoteResponse(BaseModel):
    revision_index: int
    is_current: bool = False
    source_kind: str
    summary: str
    reason: str = ""
    source_message_id: uuid.UUID | None = None
    source_message_excerpt: str | None = None
    applied_fields: list[str] = Field(default_factory=list)
    created_at: datetime
    previous_snapshot: RevisionSnapshot | None = None
    current_snapshot: RevisionSnapshot
    downstream: RevisionDownstreamSummary = Field(default_factory=RevisionDownstreamSummary)


class RevisionNoteListResponse(BaseModel):
    items: list[RevisionNoteResponse]
    total: int


# ---------------------------------------------------------------------------
# Module Decomposition
# ---------------------------------------------------------------------------


class ModuleActivity(BaseModel):
    type: str = ""
    description: str = ""
    duration_minutes: int = 0


class ModuleAssessment(BaseModel):
    method: str = ""
    criteria: list[str] = Field(default_factory=list)


class ModuleDecompositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    module_index: int
    title: str
    description: str
    learning_objectives: list[str]
    topics: list[str]
    duration_minutes: int
    activities: list[ModuleActivity]
    assessment: ModuleAssessment
    created_at: datetime

    @classmethod
    def from_orm_coerce(cls, obj: object) -> "ModuleDecompositionResponse":
        model = cast(Any, obj)
        raw_activities = model.activities or []
        raw_assessment = model.assessment or {}
        return cls.model_validate(
            {
                "id": model.id,
                "syllabus_id": model.syllabus_id,
                "module_index": model.module_index,
                "title": model.title,
                "description": model.description,
                "learning_objectives": model.learning_objectives,
                "topics": model.topics,
                "duration_minutes": model.duration_minutes,
                "activities": [ModuleActivity(**a) for a in raw_activities],
                "assessment": ModuleAssessment(**raw_assessment)
                if raw_assessment
                else ModuleAssessment(),
                "created_at": model.created_at,
            }
        )


class ModuleDecompositionListResponse(BaseModel):
    modules: list[ModuleDecompositionResponse]
    syllabus_id: uuid.UUID
    total: int


class DecomposeRequest(BaseModel):
    """Optional hints the caller can pass to influence decomposition."""

    module_count_hint: int | None = Field(
        default=None,
        ge=1,
        le=20,
        description="Preferred number of modules (advisory).",
    )
