from pathlib import Path
from typing import Any

from app.exceptions import FileParseException


async def parse_file(file_path: str, file_format: str) -> tuple[str, dict[str, Any]]:
    fmt = file_format.lower().lstrip(".")

    if fmt == "pdf":
        from app.utils.pdf_parser import parse_pdf

        return await parse_pdf(file_path)

    if fmt == "docx":
        from app.utils.docx_parser import parse_docx

        return await parse_docx(file_path)

    if fmt == "pptx":
        from app.utils.pptx_parser import parse_pptx

        return await parse_pptx(file_path)

    raise FileParseException(f"Unsupported file format: {file_format}")
