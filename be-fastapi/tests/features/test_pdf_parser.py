import pytest

from app.utils.pdf_parser import parse_pdf


class FakePage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class FakePdf:
    def __init__(self, page_count: int, page_text: str) -> None:
        self.pages = [FakePage(page_text) for _ in range(page_count)]

    def __enter__(self) -> "FakePdf":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None


@pytest.mark.asyncio
async def test_parse_pdf_limits_pages_and_flags_truncation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.utils.pdf_parser.settings.MAX_PDF_PARSE_PAGES", 3)
    monkeypatch.setattr("app.utils.pdf_parser.settings.MAX_DOCUMENT_TEXT_CHARS", 10_000)
    monkeypatch.setattr(
        "app.utils.pdf_parser.pdfplumber.open",
        lambda _path: FakePdf(page_count=10, page_text="teks halaman panjang"),
    )

    text, metadata = await parse_pdf("dummy.pdf")

    assert metadata["has_ocr"] is False
    assert metadata["page_count"] == 10
    assert metadata["parsed_page_count"] == 3
    assert metadata["text_truncated"] is True
    assert "teks halaman panjang" in text
    assert len(text) > 0
