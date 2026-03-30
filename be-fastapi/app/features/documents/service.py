import asyncio
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.embeddings import generate_embeddings_batch
from app.config import settings
from app.exceptions import (
    FileParseException,
    NotFoundException,
    ValidationException,
)
from app.features.documents.models import Document, DocumentChunk
from app.utils.chunking import chunk_text
from app.utils.file_parser import parse_file

_ALLOWED_FORMATS = {"pdf", "docx", "pptx"}
_ZERO_EMBEDDING = [0.0] * settings.EMBEDDING_DIMENSIONS
_MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
_MAX_DOCUMENT_TEXT_CHARS = settings.MAX_DOCUMENT_TEXT_CHARS


class DocumentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def upload_document(
        self,
        file: UploadFile,
        doc_type: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> Document:
        filename = file.filename or "upload"
        file_ext = Path(filename).suffix.lower().lstrip(".")
        if file_ext not in _ALLOWED_FORMATS:
            raise ValidationException("Unsupported file format. Use pdf, docx, or pptx")

        upload_dir = Path(settings.UPLOAD_DIR)
        await asyncio.to_thread(upload_dir.mkdir, parents=True, exist_ok=True)

        file_id = uuid.uuid4()
        file_path = upload_dir / f"{file_id}_{filename}"
        raw = await file.read()
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise ValidationException(f"File size exceeds {settings.MAX_UPLOAD_MB}MB limit")
        _ = await asyncio.to_thread(file_path.write_bytes, raw)

        doc = Document(
            filename=filename,
            doc_type=doc_type,
            file_format=file_ext,
            file_path=str(file_path),
            status="processing",
            owner_id=owner_id,
        )
        self.db.add(doc)
        await self.db.flush()

        try:
            content_text, metadata = await parse_file(str(file_path), file_ext)
        except Exception as exc:
            doc.status = "failed"
            raise FileParseException("Failed to parse document") from exc

        original_text_length = len(content_text)
        if original_text_length > _MAX_DOCUMENT_TEXT_CHARS:
            content_text = content_text[:_MAX_DOCUMENT_TEXT_CHARS]
            metadata["text_truncated"] = True
        metadata["stored_text_length"] = len(content_text)
        metadata["original_text_length"] = original_text_length

        doc.content_text = content_text
        doc.metadata_ = metadata

        chunks = await asyncio.to_thread(chunk_text, content_text)

        if chunks:
            try:
                embeddings = await generate_embeddings_batch(
                    [c["text"] for c in chunks], batch_size=20
                )
            except Exception:
                embeddings = [_ZERO_EMBEDDING.copy() for _ in chunks]
                metadata["embedding_fallback"] = True
            else:
                metadata["embedding_fallback"] = False

            doc.metadata_ = metadata

            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
                chunk_meta = dict(chunk["metadata"])
                chunk_meta["doc_type"] = doc_type
                if metadata.get("embedding_fallback"):
                    chunk_meta["embedding_fallback"] = True
                self.db.add(
                    DocumentChunk(
                        document_id=doc.id,
                        chunk_index=idx,
                        chunk_text=chunk["text"],
                        embedding=embedding,
                        chunk_metadata=chunk_meta,
                    )
                )

        doc.status = "ready"
        await self.db.flush()
        await self.db.refresh(doc, ["chunks"])
        return doc

    async def get_documents(self, *, owner_id: uuid.UUID | None = None) -> list[Document]:
        query = select(Document).options(selectinload(Document.chunks))
        if owner_id is not None:
            query = query.where(Document.owner_id == owner_id)
        query = query.order_by(Document.upload_date.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_document(
        self,
        document_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> Document:
        query = (
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        if owner_id is not None:
            query = query.where(Document.owner_id == owner_id)
        result = await self.db.execute(query)
        doc = result.scalar_one_or_none()
        if doc is None:
            raise NotFoundException("Document", str(document_id))
        return doc

    async def delete_document(
        self, document_id: uuid.UUID, *, owner_id: uuid.UUID | None = None
    ) -> None:
        doc = await self.get_document(document_id, owner_id=owner_id)
        file_path = Path(doc.file_path)
        await self.db.delete(doc)
        await self.db.flush()
        if file_path.exists():
            await asyncio.to_thread(file_path.unlink)
