import io
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4
from zipfile import ZipFile

import pytest

from app.features.export.service import ExportService


class FakeScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class FakeExportSession:
    def __init__(self, syllabus: object) -> None:
        self.syllabus = syllabus

    async def execute(self, statement: object) -> FakeScalarResult:
        return FakeScalarResult(self.syllabus)


@pytest.mark.asyncio
async def test_generate_docx_returns_docx_bytes() -> None:
    syllabus = SimpleNamespace(
        id=uuid4(),
        topic="Data Analytics",
        target_level=3,
        course_category="Technical Upskilling",
        client_company_name="PT Contoh Industri",
        course_title="AI Space Data Analytics Bootcamp",
        company_profile_summary="Perusahaan fokus pada transformasi data lintas fungsi.",
        commercial_overview="Program diarahkan untuk menutup gap analitik supervisor.",
        status="finalized",
        tlo="Peserta mampu menerapkan analitik data.",
        performance_result="Peserta mampu membaca dashboard dan menyusun insight.",
        condition_result="Menggunakan data operasional dan studi kasus unit kerja.",
        standard_result="Insight dapat dipresentasikan secara akurat dan dapat ditindaklanjuti.",
        elos=[{"elo": "Menganalisis data", "pce": ["A", "B", "C"]}],
        journey={
            "pre_learning": ["Belajar dasar"],
            "classroom": ["Latihan kasus"],
            "after_learning": ["Rencana aksi"],
        },
        revision_history=[{"summary": "Initial finalize"}],
        created_at=datetime.now(UTC),
    )
    service = ExportService(FakeExportSession(syllabus))

    result = await service.generate_docx(uuid4())

    assert result[:2] == b"PK"
    assert len(result) > 100

    with ZipFile(io.BytesIO(result)) as archive:
        xml = archive.read("word/document.xml").decode("utf-8")

    assert "Data Analytics" in xml
    assert "PT Contoh Industri" in xml
    assert "Technical Upskilling" in xml
    assert "AI Space Data Analytics Bootcamp" in xml
    assert "Peserta mampu menerapkan analitik data." in xml
    assert "Latihan kasus" in xml
    assert "Rencana aksi" in xml
    assert "{{" not in xml
    assert "$course_title" not in xml
    assert "$Technical Upskilling" not in xml
    assert "Silabus Kursus ini dibuat dengan bantuan Kecerdasan Artifisial (AI)" not in xml
