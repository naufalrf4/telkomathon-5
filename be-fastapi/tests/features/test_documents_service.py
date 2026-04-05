from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.exceptions import ValidationException
from app.features.documents.constants import DOCUMENT_UPLOAD_DIR
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
        self.id = kwargs.get("id", uuid4())
        self.filename = str(kwargs.get("filename", ""))
        self.doc_type = str(kwargs.get("doc_type", ""))
        self.file_format = str(kwargs.get("file_format", ""))
        self.file_path = str(kwargs.get("file_path", ""))
        self.status = str(kwargs.get("status", "uploaded"))
        self.content_text = str(kwargs.get("content_text", ""))
        raw_metadata = kwargs.get("metadata_", {})
        self.metadata_ = dict(raw_metadata) if isinstance(raw_metadata, dict) else {}
        raw_chunks = kwargs.get("chunks", [])
        self.chunks: list[object] = list(raw_chunks) if isinstance(raw_chunks, list) else []


class FakeDocumentChunkRecord:
    kwargs: dict[str, object]
    document_id: object

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.document_id = kwargs.get("document_id")


class FakeExecuteResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalars(self) -> "FakeExecuteResult":
        return self

    def all(self) -> list[object]:
        return [self.value] if self.value is not None else []


class FakeDocumentSession:
    records: list[object]
    document: FakeDocumentRecord | None

    def __init__(self) -> None:
        self.records = []
        self.document = None

    def add(self, record: object) -> None:
        self.records.append(record)
        if isinstance(record, FakeDocumentRecord):
            self.document = record
        if isinstance(record, FakeDocumentChunkRecord) and self.document is not None:
            self.document.chunks.append(record)

    async def delete(self, record: object) -> None:
        if record in self.records:
            self.records.remove(record)
        if self.document and record in self.document.chunks:
            self.document.chunks.remove(record)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, record: object, attrs: list[str] | None = None) -> None:
        _ = attrs
        if isinstance(record, FakeDocumentRecord):
            record.chunks = [
                item for item in self.records if isinstance(item, FakeDocumentChunkRecord)
            ]

    async def execute(self, _query: object) -> FakeExecuteResult:
        return FakeExecuteResult(self.document)


@pytest.mark.asyncio
async def test_upload_document_returns_uploaded_state(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_session = FakeDocumentSession()
    service = DocumentService(cast(Any, fake_session))

    monkeypatch.setattr("app.features.documents.service.Document", FakeDocumentRecord)
    monkeypatch.setattr(
        "app.features.documents.service.DOCUMENT_UPLOAD_DIR",
        DOCUMENT_UPLOAD_DIR.parent / "tests-temp-uploads",
    )

    uploaded = await service.upload_document(
        cast(Any, FakeUploadFile("audit.docx", b"hello world")),
        doc_type="audit-doc",
    )

    assert uploaded.status == "uploaded"
    assert uploaded.metadata_["processing_stage"] == "uploaded"
    assert uploaded.metadata_["last_error"] is None


@pytest.mark.asyncio
async def test_process_document_falls_back_when_embeddings_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = FakeDocumentSession()
    service = DocumentService(cast(Any, fake_session))

    monkeypatch.setattr("app.features.documents.service.Document", FakeDocumentRecord)
    monkeypatch.setattr("app.features.documents.service.DocumentChunk", FakeDocumentChunkRecord)
    monkeypatch.setattr(
        "app.features.documents.service.DOCUMENT_UPLOAD_DIR",
        DOCUMENT_UPLOAD_DIR.parent / "tests-temp-uploads",
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
    monkeypatch.setattr(
        service,
        "_get_document_for_processing",
        AsyncMock(return_value=uploaded),
    )
    processed = await service.process_document(cast(Any, uploaded.id))

    assert processed.status == "ready"
    assert processed.metadata_["embedding_fallback"] is True
    extraction = cast(dict[str, object], processed.metadata_["extraction"])
    assert extraction["company_profile_summary"]
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
async def test_retry_document_resets_failed_document_state(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_session = FakeDocumentSession()
    service = DocumentService(cast(Any, fake_session))

    monkeypatch.setattr("app.features.documents.service.Document", FakeDocumentRecord)
    monkeypatch.setattr("app.features.documents.service.DocumentChunk", FakeDocumentChunkRecord)

    document = FakeDocumentRecord(
        filename="failed.docx",
        doc_type="company-profile",
        file_format="docx",
        file_path="uploads/failed.docx",
        status="failed",
        content_text="old content",
        metadata_={"processing_stage": "failed", "last_error": "boom"},
    )
    chunk = FakeDocumentChunkRecord(document_id=document.id, chunk_metadata={})
    fake_session.document = document
    fake_session.records.extend([document, chunk])
    document.chunks.append(chunk)
    monkeypatch.setattr(service, "get_document", AsyncMock(return_value=document))

    retried = await service.retry_document(cast(Any, document.id))

    assert retried.status == "uploaded"
    assert retried.content_text == ""
    assert retried.metadata_["processing_stage"] == "uploaded"
    assert retried.metadata_["last_error"] is None
    assert retried.chunks == []


@pytest.mark.asyncio
async def test_upload_document_rejects_file_over_limit() -> None:
    service = DocumentService(cast(Any, FakeDocumentSession()))

    with pytest.raises(ValidationException, match="100MB"):
        await service.upload_document(
            cast(Any, FakeUploadFile("oversize.docx", b"x" * (100 * 1024 * 1024 + 1))),
            doc_type="company-profile",
        )


@pytest.mark.asyncio
async def test_process_document_truncates_large_parsed_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = FakeDocumentSession()
    service = DocumentService(cast(Any, fake_session))

    monkeypatch.setattr("app.features.documents.service.Document", FakeDocumentRecord)
    monkeypatch.setattr("app.features.documents.service.DocumentChunk", FakeDocumentChunkRecord)
    monkeypatch.setattr(
        "app.features.documents.service.DOCUMENT_UPLOAD_DIR",
        DOCUMENT_UPLOAD_DIR.parent / "tests-temp-uploads",
    )
    monkeypatch.setattr("app.features.documents.service.settings.MAX_DOCUMENT_TEXT_CHARS", 20)
    monkeypatch.setattr("app.features.documents.service._MAX_DOCUMENT_TEXT_CHARS", 20)
    monkeypatch.setattr(
        "app.features.documents.service.parse_file",
        AsyncMock(return_value=("x" * 50, {"source": "test"})),
    )
    monkeypatch.setattr(
        "app.features.documents.service.chunk_text",
        lambda text: [{"text": text, "metadata": {"section": "Body", "page_number": 1}}],
    )
    monkeypatch.setattr(
        "app.features.documents.service.generate_embeddings_batch",
        AsyncMock(return_value=[[0.1] * 3072]),
    )

    uploaded = await service.upload_document(
        cast(Any, FakeUploadFile("large.docx", b"hello world")),
        doc_type="company-profile",
    )
    monkeypatch.setattr(
        service,
        "_get_document_for_processing",
        AsyncMock(return_value=uploaded),
    )
    processed = await service.process_document(cast(Any, uploaded.id))

    assert len(processed.content_text) == 20
    assert processed.metadata_["text_truncated"] is True
    assert processed.metadata_["original_text_length"] == 50
    assert processed.metadata_["stored_text_length"] == 20
