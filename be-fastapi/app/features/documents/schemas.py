import uuid
from datetime import datetime
from typing import Any, cast

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
    extracted_company_name: str | None = None
    extracted_company_summary: str | None = None
    last_error: str | None = None
    can_retry: bool = False

    @classmethod
    def from_document(cls, document: Any) -> "DocumentResponse":
        metadata = cast(dict[str, object], getattr(document, "metadata_", {}) or {})
        extraction = metadata.get("extraction")
        extraction_payload = extraction if isinstance(extraction, dict) else {}
        model = cls.model_validate(document)
        model.extracted_company_name = cls._read_optional_text(
            extraction_payload.get("company_name")
        )
        model.extracted_company_summary = cls._read_optional_text(
            extraction_payload.get("company_profile_summary")
        )
        model.last_error = cls._read_optional_text(metadata.get("last_error"))
        model.can_retry = model.status == "failed"
        return model

    @staticmethod
    def _read_optional_text(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip()
        return normalized or None


class DocumentListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    documents: list[DocumentResponse]
    total: int


class DocumentDetailResponse(DocumentResponse):
    content_text: str
    metadata_: dict[str, object]
