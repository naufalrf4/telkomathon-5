import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    syllabus_id: uuid.UUID
    role: str
    content: str
    revision_applied: dict[str, object] | None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
    total: int
