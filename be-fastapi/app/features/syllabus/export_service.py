import io
import tempfile
import uuid
from pathlib import Path
from typing import Any, cast

from docx import Document as WordDocument
from docxtpl import DocxTemplate
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select

from app.exceptions import NotFoundException
from app.features.syllabus.models import GeneratedSyllabus

_TEMPLATES_DIR = Path(__file__).with_name("templates")
_PDF_TEMPLATE_NAME = "syllabus_export.html"


class SyllabusExportService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.template_env = Environment(
            loader=FileSystemLoader(_TEMPLATES_DIR),
            autoescape=select_autoescape(("html", "xml")),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    async def generate_docx(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> bytes:
        syllabus = await self._get_syllabus(syllabus_id, owner_id=owner_id)
        context = self._build_export_context(syllabus)
        return self._render_docx(context)

    async def generate_pdf(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> bytes:
        syllabus = await self._get_syllabus(syllabus_id, owner_id=owner_id)
        context = self._build_export_context(syllabus)
        try:
            from weasyprint import HTML
        except OSError:
            return self._render_basic_pdf(context)

        html = self.template_env.get_template(_PDF_TEMPLATE_NAME).render(**context)
        return cast(bytes, HTML(string=html).write_pdf())

    async def _get_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        query = select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        if owner_id is not None:
            query = query.where(GeneratedSyllabus.owner_id == owner_id)
        result = await self.db.execute(query)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return cast(GeneratedSyllabus, syllabus)

    def _build_export_context(self, syllabus: GeneratedSyllabus) -> dict[str, object]:
        journey = syllabus.journey if isinstance(syllabus.journey, dict) else {}
        revision_history = (
            [entry for entry in syllabus.revision_history if isinstance(entry, dict)][-3:]
            if syllabus.revision_history
            else []
        )
        return {
            "course_title": syllabus.course_title or syllabus.topic,
            "topic": syllabus.topic,
            "target_level": syllabus.target_level,
            "course_category": syllabus.course_category or "",
            "client_company_name": syllabus.client_company_name or "",
            "company_profile_summary": syllabus.company_profile_summary or "",
            "commercial_overview": syllabus.commercial_overview or "",
            "tlo": syllabus.tlo,
            "performance_result": syllabus.performance_result or "Belum tersedia",
            "condition_result": syllabus.condition_result or "Belum tersedia",
            "standard_result": syllabus.standard_result or "Belum tersedia",
            "elos": [item for item in syllabus.elos if isinstance(item, dict)],
            "journey_stages": [
                self._build_stage_context("Pra-pembelajaran", journey.get("pre_learning")),
                self._build_stage_context("Di kelas", journey.get("classroom")),
                self._build_stage_context("Pasca-pembelajaran", journey.get("after_learning")),
            ],
            "revision_history": [
                {
                    "summary": str(entry.get("summary", "")).strip() or "Perubahan tanpa ringkasan",
                    "reason": str(entry.get("reason", "")).strip(),
                    "applied_fields": [
                        str(item)
                        for item in cast(list[object], entry.get("applied_fields", []))
                        if isinstance(item, str)
                    ],
                }
                for entry in revision_history
            ],
        }

    def _build_stage_context(self, label: str, value: object) -> dict[str, object]:
        stage = value if isinstance(value, dict) else {}
        method_value = stage.get("method") if isinstance(stage, dict) else []
        content_value = stage.get("content") if isinstance(stage, dict) else []
        return {
            "label": label,
            "duration": str(stage.get("duration", "")).strip() if isinstance(stage, dict) else "",
            "description": str(stage.get("description", "")).strip()
            if isinstance(stage, dict)
            else "",
            "method": [
                str(item).strip()
                for item in method_value
                if isinstance(item, str) and str(item).strip()
            ]
            if isinstance(method_value, list)
            else [],
            "content": [
                str(item).strip()
                for item in content_value
                if isinstance(item, str) and str(item).strip()
            ]
            if isinstance(content_value, list)
            else [],
        }

    def _render_docx(self, context: dict[str, object]) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as template_file:
            template_path = template_file.name
        try:
            self._build_docx_template(template_path)
            document = DocxTemplate(template_path)
            document.render(context)
            buffer = io.BytesIO()
            document.save(buffer)
            return buffer.getvalue()
        finally:
            Path(template_path).unlink(missing_ok=True)

    def _build_docx_template(self, path: str) -> None:
        document = WordDocument()
        document.add_heading("{{ course_title }}", level=0)
        document.add_paragraph("Topik: {{ topic }}")
        document.add_paragraph("Level target: {{ target_level }}")
        document.add_paragraph("Kategori: {{ course_category }}")
        document.add_paragraph("Klien: {{ client_company_name }}")
        document.add_paragraph("Ringkasan perusahaan: {{ company_profile_summary }}")
        document.add_paragraph("Kebutuhan bisnis: {{ commercial_overview }}")

        for heading, field_name in (
            ("Tujuan akhir pembelajaran", "tlo"),
            ("Target performa", "performance_result"),
            ("Kondisi belajar", "condition_result"),
            ("Standar hasil", "standard_result"),
        ):
            document.add_heading(heading, level=1)
            document.add_paragraph(f"{{{{ {field_name} }}}}")

        document.add_heading("Modul belajar", level=1)
        document.add_paragraph("{% for elo in elos %}")
        document.add_paragraph("{{ loop.index }}. {{ elo.elo }}")
        document.add_paragraph("{% endfor %}")

        document.add_heading("Alur belajar", level=1)
        document.add_paragraph("{% for stage in journey_stages %}")
        document.add_heading("{{ stage.label }}", level=2)
        document.add_paragraph("Durasi: {{ stage.duration }}")
        document.add_paragraph("{{ stage.description }}")
        document.add_paragraph("Metode:")
        document.add_paragraph("{% for method_item in stage.method %}")
        document.add_paragraph("{{ method_item }}", style="List Bullet")
        document.add_paragraph("{% endfor %}")
        document.add_paragraph("Materi:")
        document.add_paragraph("{% for content_item in stage.content %}")
        document.add_paragraph("{{ content_item }}", style="List Bullet")
        document.add_paragraph("{% endfor %}")
        document.add_paragraph("{% endfor %}")

        document.add_heading("Riwayat revisi", level=1)
        document.add_paragraph("{% for revision in revision_history %}")
        document.add_paragraph(
            "{{ revision.summary }}{% if revision.reason %} — {{ revision.reason }}{% endif %}",
            style="List Bullet",
        )
        document.add_paragraph("{% endfor %}")
        document.save(path)

    def _render_basic_pdf(self, context: dict[str, object]) -> bytes:
        lines = self._pdf_lines(context)
        content_commands = ["BT", "/F1 11 Tf", "50 790 Td"]
        for line in lines:
            content_commands.append(f"({self._escape_pdf_text(line)}) Tj")
            content_commands.append("0 -16 Td")
        content_commands.append("ET")
        content = "\n".join(content_commands).encode("latin-1", errors="replace")

        objects = [
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            f"5 0 obj << /Length {len(content)} >> stream\n".encode("latin-1")
            + content
            + b"\nendstream\nendobj\n",
        ]

        pdf = bytearray(b"%PDF-1.4\n")
        offsets: list[int] = []
        for obj in objects:
            offsets.append(len(pdf))
            pdf.extend(obj)

        xref_position = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
        pdf.extend(
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_position}\n%%EOF".encode(
                "latin-1"
            )
        )
        return bytes(pdf)

    def _pdf_lines(self, context: dict[str, object]) -> list[str]:
        lines = [
            str(context.get("course_title", "")),
            f"Topik: {context.get('topic', '')}",
            f"Level target: {context.get('target_level', '')}",
            f"Kategori: {context.get('course_category', '')}",
            f"Klien: {context.get('client_company_name', '')}",
            "",
            f"Ringkasan perusahaan: {context.get('company_profile_summary', '')}",
            f"Kebutuhan bisnis: {context.get('commercial_overview', '')}",
            "",
            f"Tujuan akhir pembelajaran: {context.get('tlo', '')}",
            f"Target performa: {context.get('performance_result', '')}",
            f"Kondisi belajar: {context.get('condition_result', '')}",
            f"Standar hasil: {context.get('standard_result', '')}",
            "",
            "Modul belajar:",
        ]
        for elo in cast(list[dict[str, object]], context.get("elos", [])):
            lines.append(f"- {elo.get('elo', '')}")
        lines.append("")
        lines.append("Alur belajar:")
        for stage in cast(list[dict[str, object]], context.get("journey_stages", [])):
            lines.append(f"{stage.get('label', '')}: {stage.get('description', '')}")
        return lines[:34]

    def _escape_pdf_text(self, value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
