import uuid
from datetime import datetime
from typing import Any, ClassVar, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SyllabusGenerateRequest(BaseModel):
    topic: str
    target_level: int
    doc_ids: list[uuid.UUID]
    additional_context: str = ""

    @field_validator("target_level")
    @classmethod
    def validate_level(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("target_level must be between 1 and 5")
        return v


class ELO(BaseModel):
    elo: str
    pce: list[str]


class LearningJourney(BaseModel):
    pre_learning: list[str]
    classroom: list[str]
    after_learning: list[str]


class RevisionHistoryEntry(BaseModel):
    tlo: str
    elos: list[ELO]
    journey: LearningJourney
    revised_at: datetime
    summary: str = ""
    reason: str = ""
    source_message_id: uuid.UUID | None = None
    applied_fields: list[str] = Field(default_factory=list)


class SyllabusRevisionApplyRequest(BaseModel):
    summary: str = ""
    tlo: str | None = None
    elos: list[ELO] | None = None
    journey: LearningJourney | None = None
    reason: str = ""
    source_message_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_has_changes(self) -> "SyllabusRevisionApplyRequest":
        if self.tlo is None and self.elos is None and self.journey is None:
            raise ValueError("At least one revision field must be provided")
        return self


class SyllabusResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: uuid.UUID
    topic: str
    target_level: int
    course_category: str | None = None
    client_company_name: str | None = None
    course_title: str | None = None
    company_profile_summary: str | None = None
    commercial_overview: str | None = None
    tlo: str
    performance_result: str | None = None
    condition_result: str | None = None
    standard_result: str | None = None
    elos: list[ELO]
    journey: LearningJourney
    revision_history: list[RevisionHistoryEntry]
    status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_coerce(cls, obj: object) -> "SyllabusResponse":
        model = cast(Any, obj)
        raw = {
            "id": model.id,
            "topic": model.topic,
            "target_level": model.target_level,
            "course_category": model.course_category,
            "client_company_name": model.client_company_name,
            "course_title": model.course_title,
            "company_profile_summary": model.company_profile_summary,
            "commercial_overview": model.commercial_overview,
            "tlo": model.tlo,
            "performance_result": model.performance_result,
            "condition_result": model.condition_result,
            "standard_result": model.standard_result,
            "elos": [ELO(**e) for e in model.elos],
            "journey": LearningJourney(**model.journey),
            "revision_history": [
                RevisionHistoryEntry(
                    tlo=str(entry.get("tlo", "")),
                    elos=[ELO(**item) for item in entry.get("elos", []) if isinstance(item, dict)],
                    journey=LearningJourney(**entry.get("journey", {})),
                    revised_at=datetime.fromisoformat(str(entry.get("revised_at"))),
                    summary=str(entry.get("summary", "")),
                    reason=str(entry.get("reason", "")),
                    source_message_id=(
                        uuid.UUID(str(entry["source_message_id"]))
                        if entry.get("source_message_id")
                        else None
                    ),
                    applied_fields=[
                        str(item)
                        for item in entry.get("applied_fields", [])
                        if isinstance(item, str)
                    ],
                )
                for entry in model.revision_history
                if isinstance(entry, dict) and entry.get("revised_at")
            ],
            "status": model.status,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
        }
        return cls.model_validate(raw)


class SyllabusListResponse(BaseModel):
    syllabi: list[SyllabusResponse]
    total: int
