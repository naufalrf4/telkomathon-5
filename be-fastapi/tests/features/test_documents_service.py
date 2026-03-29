from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.exceptions import ValidationException
from app.features.documents.service import DocumentService


class FakeUploadFile:
    filename: str
    _content: bytes

    def __init__(self, filename: str, content: bytes) -> None:
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


class FakeDocumentRecord:
    id: object
    filename: str
    doc_type: str
    file_format: str
    file_path: str
    status: str
    content_text: str
    metadata_: dict[str, Any]
    chunks: list[object]

    def __init__(self, **kwargs: object) -> None:
        self.id = uuid4()
        self.filename = str(kwargs.get("filename", ""))
        self.doc_type = str(kwargs.get("doc_type", ""))
        self.file_format = str(kwargs.get("file_format", ""))
        self.file_path = str(kwargs.get("file_path", ""))
        self.status = str(kwargs.get("status", "processing"))
        self.content_text = str(kwargs.get("content_text", ""))
        raw_metadata = kwargs.get("metadata_", {})
        self.metadata_ = dict(raw_metadata) if isinstance(raw_metadata, dict) else {}
        self.chunks: list[object] = []


class FakeDocumentChunkRecord:
    kwargs: dict[str, object]

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs


class FakeDocumentSession:
    records: list[object]

    def __init__(self) -> None:
        self.records = []

    def add(self, record: object) -> None:
        self.records.append(record)

    async def flush(self) -> None:
        return None

    async def refresh(self, record: object, attrs: list[str] | None = None) -> None:
        _ = attrs
        if isinstance(record, FakeDocumentRecord):
            record.chunks = [
                item for item in self.records if isinstance(item, FakeDocumentChunkRecord)
            ]


@pytest.mark.asyncio
async def test_upload_document_falls_back_when_embeddings_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = FakeDocumentSession()
    service = DocumentService(cast(Any, fake_session))

    monkeypatch.setattr("app.features.documents.service.Document", FakeDocumentRecord)
    monkeypatch.setattr("app.features.documents.service.DocumentChunk", FakeDocumentChunkRecord)
    monkeypatch.setattr(
        "app.features.documents.service.settings.UPLOAD_DIR", "./tests-temp-uploads"
    )
    monkeypatch.setattr(
        "app.features.documents.service.parse_file",
        AsyncMock(return_value=("audit content text", {"source": "test"})),
    )
    monkeypatch.setattr(
        "app.features.documents.service.chunk_text",
        lambda text: [{"text": text, "metadata": {"section": "Body", "page_number": 1}}],
    )
    monkeypatch.setattr(
        "app.features.documents.service.generate_embeddings_batch",
        AsyncMock(side_effect=RuntimeError("embedding unavailable")),
    )

    uploaded = await service.upload_document(
        cast(Any, FakeUploadFile("audit.docx", b"hello world")),
        doc_type="audit-doc",
    )

    assert uploaded.status == "ready"
    assert uploaded.metadata_["embedding_fallback"] is True
    chunk_records = [
        item for item in fake_session.records if isinstance(item, FakeDocumentChunkRecord)
    ]
    assert len(chunk_records) == 1
    chunk_metadata = cast(dict[str, object], chunk_records[0].kwargs["chunk_metadata"])
    chunk_embedding = cast(list[float], chunk_records[0].kwargs["embedding"])
    assert chunk_metadata["embedding_fallback"] is True
    assert len(chunk_embedding) == 3072
    assert set(chunk_embedding) == {0.0}


@pytest.mark.asyncio
async def test_upload_document_rejects_file_over_50mb() -> None:
    service = DocumentService(cast(Any, FakeDocumentSession()))

    with pytest.raises(ValidationException, match="50MB"):
        await service.upload_document(
            cast(Any, FakeUploadFile("oversize.docx", b"x" * (50 * 1024 * 1024 + 1))),
            doc_type="company-profile",
        )
