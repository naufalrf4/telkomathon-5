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
        company_profile_summary="perusahaan fokus pada transformasi data lintas fungsi. fokus utama tahun berjalan adalah peningkatan kapabilitas talenta.",
        commercial_overview="Program diarahkan untuk menutup gap analitik supervisor.",
        status="finalized",
        tlo="Peserta mampu menerapkan analitik data.",
        performance_result="Peserta mampu membaca dashboard dan menyusun insight.",
        condition_result="Menggunakan data operasional dan studi kasus unit kerja.",
        standard_result="Insight dapat dipresentasikan secara akurat dan dapat ditindaklanjuti.",
        elos=[{"elo": "Menjelaskan indikator utama pada dashboard operasional."}],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "description": "Persiapan konsep dasar",
                "content": ["Belajar dasar"],
            },
            "classroom": {
                "duration": "1 hari",
                "description": "Workshop studi kasus",
                "content": ["Latihan kasus"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "description": "Implementasi rencana aksi",
                "content": ["Rencana aksi"],
            },
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
    assert "Intermediate" in xml
    assert "Perusahaan fokus pada transformasi data lintas fungsi." in xml
    assert "Fokus utama tahun berjalan adalah peningkatan kapabilitas talenta." in xml
    assert "Duration: 1 hari" in xml
    assert "Description: Workshop studi kasus" in xml
    assert "Latihan kasus" in xml
    assert "Rencana aksi" in xml
    assert "{{" not in xml
    assert "$course_title" not in xml
    assert "$Technical Upskilling" not in xml
    assert "Silabus Kursus ini dibuat dengan bantuan Kecerdasan Artifisial (AI)" not in xml
