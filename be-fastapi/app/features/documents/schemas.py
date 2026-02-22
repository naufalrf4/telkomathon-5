import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    filename: str
    doc_type: str
    file_type: str = Field(validation_alias="file_format")
    status: str
    created_at: datetime = Field(validation_alias="upload_date")
    chunk_count: int = 0


class DocumentListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    documents: list[DocumentResponse]
    total: int


class DocumentDetailResponse(DocumentResponse):
    content_text: str
    metadata_: dict
