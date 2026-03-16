import asyncio
import io
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from docxtpl import DocxTemplate, RichText
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select

from app.exceptions import NotFoundException
from app.features.syllabus.models import GeneratedSyllabus

TEMPLATES_DIR = Path(__file__).parent / "templates"
DOCX_TEMPLATE_PATH = TEMPLATES_DIR / "syllabus_template.docx"


class ExportService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def generate_docx(self, syllabus_id: uuid.UUID) -> bytes:
        syllabus = await self._get_syllabus(syllabus_id)
        return await asyncio.to_thread(self._render_docx, syllabus)

    async def generate_pdf(self, syllabus_id: uuid.UUID) -> bytes:
        import weasyprint

        syllabus = await self._get_syllabus(syllabus_id)

        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        template = env.get_template("syllabus.html")
        html_content = template.render(
            topic=syllabus.topic,
            target_level=syllabus.target_level,
            tlo=syllabus.tlo,
            elos=syllabus.elos or [],
            journey=syllabus.journey or {},
            status=syllabus.status,
            created_at=syllabus.created_at,
        )

        result_bytes = await asyncio.to_thread(
            lambda: weasyprint.HTML(string=html_content).write_pdf()
        )
        if result_bytes is None or not isinstance(result_bytes, bytes | bytearray):
            raise RuntimeError("WeasyPrint returned no PDF output")
        return bytes(result_bytes)

    async def _get_syllabus(self, syllabus_id: uuid.UUID) -> GeneratedSyllabus:
        result = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return cast(GeneratedSyllabus, syllabus)

    def _render_docx(self, syllabus: GeneratedSyllabus) -> bytes:
        template = DocxTemplate(str(DOCX_TEMPLATE_PATH))
        context = self._build_docx_context(syllabus)
        template.render(context, autoescape=True)
        buffer = io.BytesIO()
        template.save(buffer)
        return buffer.getvalue()

    def _build_docx_context(self, syllabus: GeneratedSyllabus) -> dict[str, object]:
        journey = syllabus.journey or {}
        date_stamp = datetime.now(UTC).strftime("%d %b %Y")

        return {
            "course_category": self._plain_text(
                syllabus.course_category, fallback="Level " + str(syllabus.target_level)
            ),
            "date_stamp": date_stamp,
            "client_company_name": self._plain_text(syllabus.client_company_name),
            "course_title": self._plain_text(syllabus.course_title, fallback=syllabus.topic),
            "company_profile_summary": self._rich_text(
                syllabus.company_profile_summary,
                fallback="Profil perusahaan belum disimpan pada syllabus final.",
            ),
            "commercial_overview": self._rich_text(
                syllabus.commercial_overview,
                fallback="Ringkasan komersial belum tersedia.",
            ),
            "course_name": self._plain_text(syllabus.topic),
            "tlo_result": self._rich_text(syllabus.tlo),
            "performance_result": self._rich_text(
                syllabus.performance_result,
                fallback="Performance objective belum tersedia.",
            ),
            "condition_result": self._rich_text(
                syllabus.condition_result,
                fallback=self._derived_condition_fallback(syllabus),
            ),
            "standard_result": self._rich_text(
                syllabus.standard_result,
                fallback=self._derived_standard_fallback(syllabus),
            ),
            "elo_results": self._rich_text(self._format_elos(syllabus.elos or [])),
            "pre_learning_results": self._rich_text(
                self._format_list(
                    journey.get("pre_learning", []),
                    empty_message="Belum ada aktivitas pre-learning.",
                ),
            ),
            "classroom_results": self._rich_text(
                self._format_list(
                    journey.get("classroom", []), empty_message="Belum ada aktivitas classroom."
                ),
            ),
            "after_learning_results": self._rich_text(
                self._format_list(
                    journey.get("after_learning", []),
                    empty_message="Belum ada aktivitas after-learning.",
                ),
            ),
        }

    def _plain_text(self, value: str | None, *, fallback: str = "-") -> str:
        normalized = self._normalize_export_text(value or "")
        return normalized or fallback

    def _rich_text(self, value: str | None, *, fallback: str = "-") -> RichText:
        text = self._plain_text(value, fallback=fallback)
        rich_text = RichText()
        rich_text.add(text)
        return rich_text

    def _normalize_export_text(self, value: str) -> str:
        collapsed = " ".join(value.replace("\r", " ").split())
        return collapsed.lstrip("$ ").strip()

    def _format_elos(self, elos: list[dict[str, object]]) -> str:
        if not elos:
            return "Belum ada ELO yang tersimpan."
        lines: list[str] = []
        for index, elo in enumerate(elos, start=1):
            elo_text = str(elo.get("elo", "")).strip() or f"ELO {index}"
            lines.append(f"{index}. {elo_text}")
            pce = elo.get("pce", [])
            if isinstance(pce, list):
                for point in pce:
                    point_text = str(point).strip()
                    if point_text:
                        lines.append(f"   - {point_text}")
        return "\n".join(lines)

    def _format_list(self, values: object, *, empty_message: str) -> str:
        if not isinstance(values, list) or not values:
            return empty_message
        lines = [f"- {str(value).strip()}" for value in values if str(value).strip()]
        return "\n".join(lines) or empty_message

    def _derived_condition_fallback(self, syllabus: GeneratedSyllabus) -> str:
        first_point = self._first_pce_point(syllabus)
        if first_point is None:
            return "Condition belum tersedia."
        return first_point

    def _derived_standard_fallback(self, syllabus: GeneratedSyllabus) -> str:
        unique_points: list[str] = []
        for elo in syllabus.elos or []:
            pce = elo.get("pce", []) if isinstance(elo, dict) else []
            if not isinstance(pce, list):
                continue
            for value in pce[1:]:
                point_text = str(value).strip()
                if point_text and point_text not in unique_points:
                    unique_points.append(point_text)
        if not unique_points:
            return "Standard belum tersedia."
        return "\n".join(f"- {value}" for value in unique_points)

    def _first_pce_point(self, syllabus: GeneratedSyllabus) -> str | None:
        for elo in syllabus.elos or []:
            pce = elo.get("pce", []) if isinstance(elo, dict) else []
            if not isinstance(pce, list):
                continue
            for value in pce:
                point_text = str(value).strip()
                if point_text:
                    return point_text
        return None
