import asyncio
import logging
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.constants import EMBEDDING_VECTOR_DIMENSIONS
from app.ai.embeddings import generate_embeddings_batch
from app.config import settings
from app.database import AsyncSessionLocal
from app.exceptions import (
    FileParseException,
    NotFoundException,
    ValidationException,
)
from app.features.documents.constants import (
    DOCUMENT_STATUS_EXTRACTING,
    DOCUMENT_STATUS_FAILED,
    DOCUMENT_STATUS_PROCESSING,
    DOCUMENT_STATUS_QUEUED,
    DOCUMENT_STATUS_READY,
    DOCUMENT_STATUS_UPLOADED,
    DOCUMENT_UPLOAD_DIR,
)
from app.features.documents.models import Document, DocumentChunk
from app.utils.chunking import chunk_text
from app.utils.file_parser import parse_file

_ALLOWED_FORMATS = {"pdf", "docx", "pptx"}
_ZERO_EMBEDDING = [0.0] * EMBEDDING_VECTOR_DIMENSIONS
_MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
_MAX_DOCUMENT_TEXT_CHARS = settings.MAX_DOCUMENT_TEXT_CHARS
logger = logging.getLogger(__name__)


async def process_document_task(document_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        service = DocumentService(db)
        try:
            await service.process_document(document_id)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception(
                "Document processing task failed",
                extra={"document_id": str(document_id)},
            )


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

        upload_dir = DOCUMENT_UPLOAD_DIR
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
            status=DOCUMENT_STATUS_UPLOADED,
            owner_id=owner_id,
            metadata_={
                "processing_stage": DOCUMENT_STATUS_UPLOADED,
                "last_transition_at": _iso_now(),
                "last_error": None,
                "extraction": {},
            },
        )
        self.db.add(doc)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(doc, ["chunks"])
        return doc

    async def retry_document(
        self,
        document_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> Document:
        doc = await self.get_document(document_id, owner_id=owner_id)
        if doc.status == DOCUMENT_STATUS_READY:
            raise ValidationException("Document is already ready and does not need to be retried")
        for chunk in list(doc.chunks):
            await self.db.delete(chunk)
        doc.status = DOCUMENT_STATUS_UPLOADED
        doc.content_text = ""
        doc.metadata_ = _merge_document_metadata(
            doc.metadata_,
            processing_stage=DOCUMENT_STATUS_UPLOADED,
            last_error=None,
            extraction={},
        )
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(doc, ["chunks"])
        return doc

    async def process_document(self, document_id: uuid.UUID) -> Document:
        doc = await self._get_document_for_processing(document_id)
        if doc.status == DOCUMENT_STATUS_READY:
            return doc

        await self._set_processing_state(doc, DOCUMENT_STATUS_QUEUED)
        await self._clear_document_chunks(doc)
        await self._set_processing_state(doc, DOCUMENT_STATUS_PROCESSING)

        try:
            content_text, metadata = await parse_file(doc.file_path, doc.file_format)
        except Exception as exc:
            await self._fail_document(doc, "Failed to parse document", exc)
            raise FileParseException("Failed to parse document") from exc

        original_text_length = len(content_text)
        if original_text_length > _MAX_DOCUMENT_TEXT_CHARS:
            content_text = content_text[:_MAX_DOCUMENT_TEXT_CHARS]
            metadata["text_truncated"] = True
        metadata["stored_text_length"] = len(content_text)
        metadata["original_text_length"] = original_text_length

        doc.content_text = content_text
        await self._set_processing_state(doc, DOCUMENT_STATUS_EXTRACTING, extra_metadata=metadata)

        extraction = _extract_company_metadata(doc.filename, content_text)
        metadata["extraction"] = extraction

        chunks = cast(list[dict[str, Any]], await asyncio.to_thread(chunk_text, content_text))

        if chunks:
            try:
                embeddings = await generate_embeddings_batch(
                    [cast(str, c["text"]) for c in chunks], batch_size=20
                )
            except Exception as exc:
                embeddings = [_ZERO_EMBEDDING.copy() for _ in chunks]
                metadata["embedding_fallback"] = True
                logger.warning(
                    "Embedding generation failed; storing zero-vector fallback embeddings",
                    extra={"document_id": str(doc.id), "chunk_count": len(chunks)},
                    exc_info=exc,
                )
            else:
                metadata["embedding_fallback"] = False

            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
                chunk_meta = dict(cast(dict[str, object], chunk["metadata"]))
                chunk_meta["doc_type"] = doc.doc_type
                if metadata.get("embedding_fallback"):
                    chunk_meta["embedding_fallback"] = True
                self.db.add(
                    DocumentChunk(
                        document_id=doc.id,
                        chunk_index=idx,
                        chunk_text=cast(str, chunk["text"]),
                        embedding=embedding,
                        chunk_metadata=chunk_meta,
                    )
                )

        doc.metadata_ = _merge_document_metadata(metadata, processing_stage=DOCUMENT_STATUS_READY)
        doc.status = DOCUMENT_STATUS_READY
        await self.db.flush()
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

    async def _get_document_for_processing(self, document_id: uuid.UUID) -> Document:
        query = (
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        result = await self.db.execute(query)
        doc = result.scalar_one_or_none()
        if doc is None:
            raise NotFoundException("Document", str(document_id))
        return doc

    async def _clear_document_chunks(self, doc: Document) -> None:
        for chunk in list(doc.chunks):
            await self.db.delete(chunk)
        await self.db.flush()

    async def _set_processing_state(
        self,
        doc: Document,
        status: str,
        *,
        extra_metadata: dict[str, object] | None = None,
    ) -> None:
        doc.status = status
        doc.metadata_ = _merge_document_metadata(
            doc.metadata_,
            processing_stage=status,
            last_error=None,
            **(extra_metadata or {}),
        )
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(doc, ["chunks"])

    async def _fail_document(
        self,
        doc: Document,
        message: str,
        exc: Exception,
    ) -> None:
        logger.warning(
            "Document processing failed",
            extra={"document_id": str(doc.id), "status": doc.status},
            exc_info=exc,
        )
        doc.status = DOCUMENT_STATUS_FAILED
        doc.metadata_ = _merge_document_metadata(
            doc.metadata_,
            processing_stage=DOCUMENT_STATUS_FAILED,
            last_error=message,
        )
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(doc, ["chunks"])


def _merge_document_metadata(
    existing: dict[str, object] | None,
    **updates: object,
) -> dict[str, object]:
    metadata = dict(existing or {})
    for key, value in updates.items():
        metadata[key] = value
    metadata["last_transition_at"] = _iso_now()
    return metadata


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _extract_company_metadata(filename: str, content_text: str) -> dict[str, object]:
    company_name = _extract_company_name(content_text, filename)
    focus_points = _extract_focus_points(content_text)
    company_profile_summary = _build_company_summary(company_name, focus_points)
    confidence = "medium" if company_name or focus_points else "low"
    return {
        "company_name": company_name,
        "company_profile_summary": company_profile_summary,
        "company_profile_focus": focus_points,
        "confidence": confidence,
    }


def _extract_company_name(content_text: str, filename: str) -> str | None:
    sample = " ".join(content_text.replace("\r", " ").split())[:4000]
    patterns = (
        r"\b(PT\.?\s+[A-Z][A-Za-z0-9&.,\- ]{2,80})",
        r"\b(CV\.?\s+[A-Z][A-Za-z0-9&.,\- ]{2,80})",
        r"\b(Perum\s+[A-Z][A-Za-z0-9&.,\- ]{2,80})",
    )
    for pattern in patterns:
        match = re.search(pattern, sample)
        if match:
            return _normalize_company_name(match.group(1))

    title_like = re.sub(r"[_\-]+", " ", Path(filename).stem).strip()
    normalized_title = _normalize_company_name(title_like)
    return normalized_title if normalized_title and len(normalized_title.split()) <= 6 else None


def _normalize_company_name(value: str) -> str | None:
    normalized = " ".join(value.split()).strip(" .,-")
    if not normalized or len(normalized) < 3:
        return None
    return normalized


def _extract_focus_points(content_text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+|\n+", content_text)
    scored_points: list[tuple[int, str]] = []
    for sentence in sentences:
        cleaned = " ".join(sentence.replace("\r", " ").split()).strip(" -•*")
        if len(cleaned) < 40:
            continue
        lowered = cleaned.lower()
        score = sum(
            1
            for marker in (
                "perusahaan",
                "layanan",
                "bisnis",
                "digital",
                "talenta",
                "kapabilitas",
                "inovasi",
                "data",
                "pelanggan",
                "operasional",
            )
            if marker in lowered
        )
        if score < 2:
            continue
        scored_points.append((score, cleaned.rstrip(".") + "."))
        if len(scored_points) >= 8:
            break

    deduped: list[str] = []
    for _, point in sorted(scored_points, key=lambda item: (-item[0], len(item[1]))):
        if point not in deduped:
            deduped.append(point)
        if len(deduped) >= 3:
            break
    return deduped


def _build_company_summary(company_name: str | None, focus_points: list[str]) -> str:
    subject = (
        company_name
        if company_name and company_name.lower().startswith(("pt ", "pt.", "cv ", "cv.", "perum "))
        else f"Perusahaan {company_name}"
        if company_name
        else "Perusahaan ini"
    )
    sector = _detect_sector_phrase(focus_points)
    focus = _build_focus_phrase(focus_points)
    return f"{subject} bergerak di {sector}. Fokus utama tahun berjalan adalah {focus}."


def _detect_sector_phrase(focus_points: list[str]) -> str:
    lowered = " ".join(point.lower() for point in focus_points)
    if "konektivitas" in lowered:
        return "layanan digital dan konektivitas"
    if "data" in lowered and "anal" in lowered:
        return "pengelolaan data dan pengambilan keputusan berbasis data"
    if "talenta" in lowered or "kompetensi" in lowered:
        return "pengembangan kapabilitas organisasi dan talenta"
    if "pelanggan" in lowered or "layanan" in lowered:
        return "layanan bisnis dan operasional organisasi"
    return "bidang operasional yang mendukung prioritas bisnis organisasi"


def _build_focus_phrase(focus_points: list[str]) -> str:
    if not focus_points:
        return "penguatan kapabilitas talenta, akselerasi inovasi, dan pengambilan keputusan berbasis data"
    clauses = [_trim_focus_clause(point) for point in focus_points if _trim_focus_clause(point)]
    if not clauses:
        return "penguatan kapabilitas talenta, akselerasi inovasi, dan pengambilan keputusan berbasis data"
    if len(clauses) == 1:
        return clauses[0]
    if len(clauses) == 2:
        return f"{clauses[0]} dan {clauses[1]}"
    return f"{clauses[0]}, {clauses[1]}, dan {clauses[2]}"


def _trim_focus_clause(value: str) -> str:
    cleaned = value.rstrip(".")
    cleaned = re.sub(r"^(perusahaan|organisasi)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"^(fokus utama (perusahaan|tahun berjalan) (adalah|mencakup)\s+)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned[:160].strip(" ,")
