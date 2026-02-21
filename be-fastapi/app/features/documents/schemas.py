import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    doc_type: str
    file_format: str
    status: str
    upload_date: datetime
    chunk_count: int = 0


class DocumentListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    documents: list[DocumentResponse]
    total: int


class DocumentDetailResponse(DocumentResponse):
    content_text: str
    metadata_: dict
