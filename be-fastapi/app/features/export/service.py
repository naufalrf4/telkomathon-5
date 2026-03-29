import asyncio
import io
import uuid
from datetime import UTC, datetime
from pathlib import Path
from re import split as re_split
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
        template.render(self._build_docx_context(syllabus), autoescape=True)
        buffer = io.BytesIO()
        template.save(buffer)
        return buffer.getvalue()

    def _build_docx_context(self, syllabus: GeneratedSyllabus) -> dict[str, object]:
        date_stamp = datetime.now(UTC).strftime("%d %b %Y")
        return {
            "course_category": self._plain_text(
                syllabus.course_category,
                fallback=f"Level {syllabus.target_level}",
            ),
            "course_expertise_level": self._course_expertise_level(syllabus.target_level),
            "date_stamp": date_stamp,
            "client_company_name": self._plain_text(syllabus.client_company_name),
            "course_title": self._plain_text(syllabus.course_title, fallback=syllabus.topic),
            "company_profile_summary": self._rich_text(
                self._format_company_profile_summary(syllabus.company_profile_summary),
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
                fallback="Condition belum tersedia.",
            ),
            "standard_result": self._rich_text(
                syllabus.standard_result,
                fallback=self._derived_standard_fallback(syllabus),
            ),
            "elo_results": self._rich_text(self._format_elos(syllabus.elos or [])),
            "pre_learning_results": self._rich_text(
                self._format_stage(
                    syllabus.journey, "pre_learning", "Belum ada aktivitas pre-learning."
                )
            ),
            "classroom_results": self._rich_text(
                self._format_stage(syllabus.journey, "classroom", "Belum ada aktivitas classroom.")
            ),
            "after_learning_results": self._rich_text(
                self._format_stage(
                    syllabus.journey, "after_learning", "Belum ada aktivitas after-learning."
                )
            ),
        }

    def _plain_text(self, value: str | None, *, fallback: str = "-") -> str:
        normalized = self._normalize_export_text(value or "")
        return normalized or fallback

    def _rich_text(self, value: str | None, *, fallback: str = "-") -> RichText:
        rich_text = RichText()
        rich_text.add(self._plain_text(value, fallback=fallback))
        return rich_text

    def _normalize_export_text(self, value: str) -> str:
        collapsed = " ".join(value.replace("\r", " ").split())
        return collapsed.lstrip("$ ").strip()

    def _format_company_profile_summary(self, value: str | None) -> str | None:
        normalized = self._normalize_export_text(value or "")
        if not normalized:
            return None

        sentences = [
            segment.strip() for segment in re_split(r"(?<=[.!?])\s+", normalized) if segment.strip()
        ]
        if not sentences:
            return normalized[:1].upper() + normalized[1:] if normalized else None

        formatted: list[str] = []
        for sentence in sentences:
            cleaned = sentence.strip()
            if not cleaned:
                continue
            punctuation = cleaned[-1] if cleaned[-1] in ".!?" else "."
            body = (
                cleaned[:-1]
                if punctuation != "." or cleaned.endswith((".", "!", "?"))
                else cleaned.rstrip(".")
            )
            body = body.strip().rstrip(".!?")
            if not body:
                continue
            formatted.append(body[:1].upper() + body[1:] + punctuation)
        return " ".join(formatted) if formatted else None

    def _format_elos(self, elos: list[dict[str, object]]) -> str:
        if not elos:
            return "Belum ada ELO yang tersimpan."
        lines: list[str] = []
        for index, elo in enumerate(elos, start=1):
            elo_text = self._normalize_export_text(str(elo.get("elo", "")))
            if elo_text:
                lines.append(f"{index}. {elo_text}")
        return "\n".join(lines) or "Belum ada ELO yang tersimpan."

    def _format_stage(
        self,
        journey: object,
        stage_name: str,
        empty_message: str,
    ) -> str:
        if not isinstance(journey, dict):
            return empty_message
        stage = journey.get(stage_name)
        if isinstance(stage, list):
            content_lines = [
                f"- {self._normalize_export_text(str(item))}"
                for item in stage
                if isinstance(item, str) and self._normalize_export_text(str(item))
            ]
            return "\n".join(["Content:", *content_lines]) if content_lines else empty_message
        if not isinstance(stage, dict):
            return empty_message

        duration = self._normalize_export_text(str(stage.get("duration", "")))
        description = self._normalize_export_text(str(stage.get("description", "")))
        content = stage.get("content")
        content_lines = (
            [
                f"- {self._normalize_export_text(str(item))}"
                for item in content
                if isinstance(item, str) and self._normalize_export_text(str(item))
            ]
            if isinstance(content, list)
            else []
        )

        parts: list[str] = []
        if duration:
            parts.append(f"Duration: {duration}")
        if description:
            parts.append(f"Description: {description}")
        if content_lines:
            parts.append("Content:")
            parts.extend(content_lines)
        return "\n".join(parts) if parts else empty_message

    def _derived_standard_fallback(self, syllabus: GeneratedSyllabus) -> str:
        elo_count = len([item for item in syllabus.elos or [] if isinstance(item, dict)])
        if elo_count <= 0:
            return "Standard belum tersedia."
        return (
            f"Keberhasilan peserta diukur melalui ketercapaian {elo_count} enabling learning outcome, "
            "akurasi pemahaman konsep, dan kejelasan penjelasan terhadap konteks kerja."
        )

    def _course_expertise_level(self, target_level: int) -> str:
        mapping = {
            1: "Foundational",
            2: "Elementary",
            3: "Intermediate",
            4: "Advanced",
            5: "Expert",
        }
        return mapping.get(target_level, f"Level {target_level}")
