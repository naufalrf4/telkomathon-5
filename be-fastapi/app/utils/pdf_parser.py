import asyncio
from typing import Any

import pdfplumber

from app.config import settings
from app.exceptions import FileParseException
from app.utils.ocr import extract_text_with_ocr

_MIN_TEXT_LENGTH = 50


async def parse_pdf(file_path: str) -> tuple[str, dict[str, Any]]:
    try:
        text, metadata = await asyncio.to_thread(_extract_pdf_text, file_path)
        if len(text.strip()) < _MIN_TEXT_LENGTH:
            text = await extract_text_with_ocr(file_path)
            metadata["has_ocr"] = True
            metadata["text_truncated"] = len(text) > settings.MAX_DOCUMENT_TEXT_CHARS
            if metadata["text_truncated"]:
                text = text[: settings.MAX_DOCUMENT_TEXT_CHARS]
            return text, metadata
        metadata["has_ocr"] = False
        return text, metadata
    except FileParseException:
        raise
    except Exception as exc:
        raise FileParseException(f"PDF parsing failed: {exc}") from exc


def _extract_pdf_text(file_path: str) -> tuple[str, dict[str, Any]]:
    pages: list[str] = []
    page_count = 0
    parsed_pages = 0
    truncated = False
    max_chars = settings.MAX_DOCUMENT_TEXT_CHARS
    max_pages = settings.MAX_PDF_PARSE_PAGES
    with pdfplumber.open(file_path) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            if parsed_pages >= max_pages:
                truncated = True
                break
            page_text = page.extract_text() or ""
            pages.append(page_text)
            parsed_pages += 1
            if sum(len(chunk) for chunk in pages) >= max_chars:
                truncated = True
                break
    text = "\n\n".join(pages)
    if len(text) > max_chars:
        text = text[:max_chars]
        truncated = True
    return text, {
        "page_count": page_count,
        "parsed_page_count": parsed_pages,
        "text_truncated": truncated,
    }
