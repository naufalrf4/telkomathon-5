import asyncio
from typing import Any

import pdfplumber

from app.exceptions import FileParseException
from app.utils.ocr import extract_text_with_ocr

_MIN_TEXT_LENGTH = 50


async def parse_pdf(file_path: str) -> tuple[str, dict[str, Any]]:
    try:
        text = await asyncio.to_thread(_extract_pdf_text, file_path)
        if len(text.strip()) < _MIN_TEXT_LENGTH:
            text = await extract_text_with_ocr(file_path)
            return text, {"has_ocr": True}
        return text, {"has_ocr": False}
    except FileParseException:
        raise
    except Exception as exc:
        raise FileParseException(f"PDF parsing failed: {exc}") from exc


def _extract_pdf_text(file_path: str) -> str:
    pages: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            pages.append(page_text)
    return "\n\n".join(pages)
