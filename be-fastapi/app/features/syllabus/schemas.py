import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


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


class SyllabusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    topic: str
    target_level: int
    tlo: str
    elos: list[ELO]
    journey: LearningJourney
    status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_coerce(cls, obj: object) -> "SyllabusResponse":
        raw = {
            "id": getattr(obj, "id"),
            "topic": getattr(obj, "topic"),
            "target_level": getattr(obj, "target_level"),
            "tlo": getattr(obj, "tlo"),
            "elos": [ELO(**e) for e in getattr(obj, "elos", [])],
            "journey": LearningJourney(**getattr(obj, "journey", {})),
            "status": getattr(obj, "status"),
            "created_at": getattr(obj, "created_at"),
            "updated_at": getattr(obj, "updated_at"),
        }
        return cls.model_validate(raw)


class SyllabusListResponse(BaseModel):
    syllabi: list[SyllabusResponse]
    total: int
