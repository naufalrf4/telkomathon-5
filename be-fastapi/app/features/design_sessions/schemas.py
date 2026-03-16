import uuid
from datetime import datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, field_validator


class DesignSessionCreateRequest(BaseModel):
    document_ids: list[uuid.UUID]

    @field_validator("document_ids")
    @classmethod
    def validate_document_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if not value:
            raise ValueError("document_ids must not be empty")
        return value


class SourceSummaryResponse(BaseModel):
    summary: str
    key_points: list[str]


class CourseContextRequest(BaseModel):
    topic: str
    target_level: int
    additional_context: str = ""
    course_category: str = ""
    client_company_name: str = ""
    course_title: str = ""
    commercial_overview: str = ""

    @field_validator("target_level")
    @classmethod
    def validate_level(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("target_level must be between 1 and 5")
        return value


class OptionSelectionRequest(BaseModel):
    option_id: str


class ELOSelectionRequest(BaseModel):
    option_ids: list[str]

    @field_validator("option_ids")
    @classmethod
    def validate_option_ids(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("option_ids must not be empty")
        return value


class TLOOptionResponse(BaseModel):
    id: str
    text: str
    rationale: str


class PerformanceOptionResponse(BaseModel):
    id: str
    text: str
    rationale: str


class ELOOptionResponse(BaseModel):
    id: str
    elo: str
    pce: list[str]
    rationale: str


class DesignSessionResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_ids: list[uuid.UUID]
    wizard_step: str
    source_summary: SourceSummaryResponse | None
    course_context: CourseContextRequest | None
    tlo_options: list[TLOOptionResponse]
    selected_tlo: TLOOptionResponse | None
    performance_options: list[PerformanceOptionResponse]
    selected_performance: PerformanceOptionResponse | None
    elo_options: list[ELOOptionResponse]
    selected_elos: list[ELOOptionResponse]
    finalized_syllabus_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_coerce(cls, obj: object) -> "DesignSessionResponse":
        values = vars(obj)
        source_summary_value = values.get("source_summary")
        course_context_value = values.get("course_context")
        selected_tlo_value = values.get("selected_tlo")
        selected_performance_value = values.get("selected_performance")

        raw = {
            "id": values["id"],
            "document_ids": [uuid.UUID(str(item)) for item in values.get("document_ids", [])],
            "wizard_step": values["wizard_step"],
            "source_summary": (
                SourceSummaryResponse(**source_summary_value)
                if isinstance(source_summary_value, dict)
                else None
            ),
            "course_context": (
                CourseContextRequest(**course_context_value)
                if isinstance(course_context_value, dict)
                else None
            ),
            "tlo_options": [
                TLOOptionResponse(**item) for item in values.get("tlo_options", []) or []
            ],
            "selected_tlo": (
                TLOOptionResponse(**selected_tlo_value)
                if isinstance(selected_tlo_value, dict)
                else None
            ),
            "performance_options": [
                PerformanceOptionResponse(**item)
                for item in values.get("performance_options", []) or []
            ],
            "selected_performance": (
                PerformanceOptionResponse(**selected_performance_value)
                if isinstance(selected_performance_value, dict)
                else None
            ),
            "elo_options": [
                ELOOptionResponse(**item) for item in values.get("elo_options", []) or []
            ],
            "selected_elos": [
                ELOOptionResponse(**item) for item in values.get("selected_elos", []) or []
            ],
            "finalized_syllabus_id": values.get("finalized_syllabus_id"),
            "created_at": values["created_at"],
            "updated_at": values["updated_at"],
        }
        return cls.model_validate(raw)
