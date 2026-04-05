from datetime import UTC, datetime
from io import BytesIO
from uuid import uuid4

import pytest
from docx import Document as WordDocument

from app.features.syllabus.export_service import SyllabusExportService
from app.features.syllabus.models import GeneratedSyllabus


class FakeScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class FakeExportSession:
    def __init__(self, syllabus: GeneratedSyllabus) -> None:
        self.syllabus = syllabus

    async def execute(self, statement: object) -> FakeScalarResult:
        _ = statement
        return FakeScalarResult(self.syllabus)


def build_syllabus() -> GeneratedSyllabus:
    return GeneratedSyllabus(
        id=uuid4(),
        topic='Data Analytics',
        target_level=3,
        course_category='Technical',
        client_company_name='PT Demo',
        course_title='Data Analytics Bootcamp',
        company_profile_summary='Ringkasan perusahaan',
        commercial_overview='Program akselerasi analitik.',
        tlo='Peserta mampu membaca dan menjelaskan data operasional.',
        performance_result='Menyusun insight dari dashboard.',
        condition_result='Dengan studi kasus perusahaan.',
        standard_result='Akurat dan mudah dipahami.',
        elos=[{'elo': 'Mengenali metrik utama'}, {'elo': 'Menyusun insight'}],
        journey={
            'pre_learning': {
                'duration': '30 menit',
                'method': ['Belajar mandiri'],
                'description': 'Pra-belajar',
                'content': ['Artikel pengantar'],
            },
            'classroom': {
                'duration': '1 hari',
                'method': ['Workshop'],
                'description': 'Kelas',
                'content': ['Latihan dashboard'],
            },
            'after_learning': {
                'duration': '1 minggu',
                'method': ['Praktik'],
                'description': 'Tindak lanjut',
                'content': ['Refleksi hasil'],
            },
        },
        source_doc_ids=[str(uuid4())],
        revision_history=[],
        status='finalized',
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_generate_docx_returns_readable_document() -> None:
    syllabus = build_syllabus()
    service = SyllabusExportService(FakeExportSession(syllabus))

    payload = await service.generate_docx(syllabus.id)

    assert payload[:2] == b'PK'
    document = WordDocument(BytesIO(payload))
    text = '\n'.join(paragraph.text for paragraph in document.paragraphs)
    assert 'Data Analytics Bootcamp' in text
    assert 'Tujuan akhir pembelajaran' in text
    assert 'Modul belajar' in text


@pytest.mark.asyncio
async def test_generate_pdf_returns_pdf_bytes() -> None:
    syllabus = build_syllabus()
    service = SyllabusExportService(FakeExportSession(syllabus))

    payload = await service.generate_pdf(syllabus.id)

    assert payload.startswith(b'%PDF')
