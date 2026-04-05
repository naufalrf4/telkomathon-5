import uuid
from datetime import datetime
from typing import Any, ClassVar, cast

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
    company_profile_focus: list[str] = []
    company_name: str | None = None
    company_profile_summary: str | None = None
    company_profile_confidence: str | None = None


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
    preview_condition_result: str | None = None
    preview_standard_result: str | None = None
    elo_options: list[ELOOptionResponse]
    selected_elos: list[ELOOptionResponse]
    finalized_syllabus_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_coerce(cls, obj: object) -> "DesignSessionResponse":
        model = cast(Any, obj)
        source_summary_value = model.source_summary
        course_context_value = model.course_context
        selected_tlo_value = model.selected_tlo
        selected_performance_value = model.selected_performance

        raw = {
            "id": model.id,
            "document_ids": [uuid.UUID(str(item)) for item in model.document_ids or []],
            "wizard_step": model.wizard_step,
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
                TLOOptionResponse(**item)
                for item in model.tlo_options or []
                if isinstance(item, dict)
            ],
            "selected_tlo": (
                TLOOptionResponse(**selected_tlo_value)
                if isinstance(selected_tlo_value, dict)
                else None
            ),
            "performance_options": [
                PerformanceOptionResponse(**item)
                for item in model.performance_options or []
                if isinstance(item, dict)
            ],
            "selected_performance": (
                PerformanceOptionResponse(**selected_performance_value)
                if isinstance(selected_performance_value, dict)
                else None
            ),
            "preview_condition_result": getattr(model, "preview_condition_result", None),
            "preview_standard_result": getattr(model, "preview_standard_result", None),
            "elo_options": [
                ELOOptionResponse(**item)
                for item in model.elo_options or []
                if isinstance(item, dict)
            ],
            "selected_elos": [
                ELOOptionResponse(**item)
                for item in model.selected_elos or []
                if isinstance(item, dict)
            ],
            "finalized_syllabus_id": model.finalized_syllabus_id,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
        }
        return cls.model_validate(raw)
