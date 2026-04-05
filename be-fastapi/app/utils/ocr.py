import asyncio

from app.exceptions import FileParseException


async def extract_text_with_ocr(file_path: str) -> str:
    try:
        import pytesseract
        from pdf2image import convert_from_path

        images = await asyncio.to_thread(
            convert_from_path,
            file_path,
            dpi=300,
        )

        pages: list[str] = []
        for image in images:
            page_text = await asyncio.to_thread(
                pytesseract.image_to_string,
                image,
                lang="ind+eng",
            )
            pages.append(page_text)

        return "\n\n".join(pages)
    except Exception as exc:
        raise FileParseException(f"OCR extraction failed: {exc}") from exc
