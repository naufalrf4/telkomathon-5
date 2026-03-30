import asyncio
import copy
import io
import os
import re
import tempfile
import uuid
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from re import split as re_split
from typing import Any, cast
from zipfile import ZIP_DEFLATED, ZipFile

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

    async def generate_docx(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> bytes:
        syllabus = await self._get_syllabus(syllabus_id, owner_id=owner_id)
        return await asyncio.to_thread(self._render_docx, syllabus)

    async def generate_pdf(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> bytes:
        import weasyprint

        syllabus = await self._get_syllabus(syllabus_id, owner_id=owner_id)

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

    async def _get_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        if owner_id is not None:
            stmt = stmt.where(GeneratedSyllabus.owner_id == owner_id)
        result = await self.db.execute(stmt)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return cast(GeneratedSyllabus, syllabus)

    def _render_docx(self, syllabus: GeneratedSyllabus) -> bytes:
        normalized_template_path = self._prepare_runtime_template()
        try:
            template = DocxTemplate(str(normalized_template_path))
            template.render(self._build_docx_context(syllabus), autoescape=True)
            buffer = io.BytesIO()
            template.save(buffer)
            return buffer.getvalue()
        finally:
            if normalized_template_path != DOCX_TEMPLATE_PATH:
                normalized_template_path.unlink(missing_ok=True)

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
            "learning_journey_category": self._rich_text("", fallback=""),
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
            "pre_learning_duration": self._rich_text(
                self._stage_duration(syllabus.journey, "pre_learning"), fallback="-"
            ),
            "pre_learning_method": self._rich_text(
                self._stage_method(syllabus.journey, "pre_learning"), fallback="-"
            ),
            "pre_learning_content_list": self._rich_text(
                self._stage_content_list(syllabus.journey, "pre_learning"), fallback="-"
            ),
            "pre_learning_evaluation": self._rich_text(
                self._stage_evaluation(syllabus.journey, "pre_learning"), fallback="-"
            ),
            "classroom_duration": self._rich_text(
                self._stage_duration(syllabus.journey, "classroom"), fallback="-"
            ),
            "classroom_method": self._rich_text(
                self._stage_method(syllabus.journey, "classroom"), fallback="-"
            ),
            "classroom_content_list": self._rich_text(
                self._stage_content_list(syllabus.journey, "classroom"), fallback="-"
            ),
            "classroom_evaluation": self._rich_text(
                self._stage_evaluation(syllabus.journey, "classroom"), fallback="-"
            ),
            "after_learning_duration": self._rich_text(
                self._stage_duration(syllabus.journey, "after_learning"), fallback="-"
            ),
            "after_learning_method": self._rich_text(
                self._stage_method(syllabus.journey, "after_learning"), fallback="-"
            ),
            "after_learning_evaluation": self._rich_text(
                self._stage_evaluation(syllabus.journey, "after_learning"), fallback="-"
            ),
        }

    def _prepare_runtime_template(self) -> Path:
        fd, tmp_name = tempfile.mkstemp(suffix=".docx", dir=str(TEMPLATES_DIR))
        os.close(fd)
        temp_path = Path(tmp_name)
        with (
            ZipFile(DOCX_TEMPLATE_PATH, "r") as source,
            ZipFile(temp_path, "w", ZIP_DEFLATED) as target,
        ):
            for item in source.infolist():
                data = source.read(item.filename)
                if item.filename == "word/document.xml":
                    xml = data.decode("utf-8", "ignore")
                    data = self._normalize_template_xml(xml).encode("utf-8")
                target.writestr(item, data)
        return temp_path

    def _normalize_template_xml(self, xml: str) -> str:
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        ET.register_namespace("w", namespace["w"])
        root = ET.fromstring(xml)

        for paragraph in root.findall(".//w:p", namespace):
            text_nodes = paragraph.findall(".//w:t", namespace)
            if not text_nodes:
                continue

            combined_text = "".join(node.text or "" for node in text_nodes)
            normalized_text = self._normalize_placeholder_text(combined_text)
            if normalized_text == combined_text:
                continue

            paragraph_props = next(
                (child for child in list(paragraph) if child.tag == f"{{{namespace['w']}}}pPr"),
                None,
            )
            first_run_props = next(
                (
                    copy.deepcopy(run_props)
                    for run in paragraph.findall("w:r", namespace)
                    for run_props in run.findall("w:rPr", namespace)
                ),
                None,
            )

            for child in list(paragraph):
                if paragraph_props is not None and child is paragraph_props:
                    continue
                paragraph.remove(child)

            run = ET.Element(f"{{{namespace['w']}}}r")
            if first_run_props is not None:
                run.append(first_run_props)

            text_element = ET.SubElement(run, f"{{{namespace['w']}}}t")
            if normalized_text.startswith(" ") or normalized_text.endswith(" "):
                text_element.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            text_element.text = normalized_text
            paragraph.append(run)

        return ET.tostring(root, encoding="unicode")

    def _normalize_placeholder_text(self, text: str) -> str:
        if "{{" not in text:
            return text

        normalized = " ".join(text.split())
        replacements: list[tuple[str, str]] = [
            (r"\{\{\s*course\s*_\s*expertise\s*_\s*level\s*\}\}+", "{{ course_expertise_level }}"),
            (r"\{\{\s*course\s*_\s*name\s*\}\}+", "{{ course_name }}"),
            (r"\{\{\s*course\s*_\s*category\s*\}\}+", "{{ course_category }}"),
            (r"\{\{\s*date\s*_\s*stamp\s*\}\}+", "{{ date_stamp }}"),
            (r"\{\{\s*client\s*_\s*company\s*_\s*name\s*\}\}+", "{{ client_company_name }}"),
            (r"\{\{\s*course\s*_\s*title\s*\}\}+", "{{ course_title }}"),
            (
                r"\{\{r\s*company\s*_\s*profile\s*_\s*summary\s*\}\}+",
                "{{r company_profile_summary }}",
            ),
            (r"\{\{r\s*commercial\s*_\s*overview\s*\}\}+", "{{r commercial_overview }}"),
            (r"\{\{r\s*tlo\s*_\s*result\s*\}\}+", "{{r tlo_result }}"),
            (r"\{\{r\s*performance\s*_\s*result\s*\}\}+", "{{r performance_result }}"),
            (r"\{\{r\s*condition\s*_\s*result\s*\}\}+", "{{r condition_result }}"),
            (r"\{\{r\s*standard\s*_\s*result\s*\}\}+", "{{r standard_result }}"),
            (r"\{\{r\s*elo\s*_\s*results\s*\}\}+", "{{r elo_results }}"),
            (
                r"\{\{r\s*learning\s*_?journey\s+category\s*\}\}+",
                "{{r learning_journey_category }}",
            ),
            (r"\{\{r\s*pre\s*_\s*learning\s*_\s*duration\s*\}\}+", "{{r pre_learning_duration }}"),
            (r"\{\{r\s*pre\s*_\s*learning\s*_\s*method\s*\}\}+", "{{r pre_learning_method }}"),
            (
                r"\{\{r\s*pre\s*_\s*learning\s*_\s*content\s*_\s*list\s*\}\}+",
                "{{r pre_learning_content_list }}",
            ),
            (
                r"\{\{r\s*pre\s*_\s*learning\s*_\s*evaluation\s*\}\}+",
                "{{r pre_learning_evaluation }}",
            ),
            (r"\{\{r\s*classroom\s*_\s*duration\s*\}\}+", "{{r classroom_duration }}"),
            (r"\{\{r\s*classroom\s*_\s*method\s*\}\}+", "{{r classroom_method }}"),
            (
                r"\{\{r\s*classroom\s*_\s*content\s*_\s*list\s*\}\}+",
                "{{r classroom_content_list }}",
            ),
            (r"\{\{r\s*classroom\s*_\s*evaluation\s*\}\}+", "{{r classroom_evaluation }}"),
            (
                r"\{\{r\s*after\s*_\s*learning\s*_\s*duration\s*\}\}+",
                "{{r after_learning_duration }}",
            ),
            (r"\{\{r\s*after\s*_\s*learning\s*_\s*method\s*\}\}+", "{{r after_learning_method }}"),
            (
                r"\{\{r\s*after\s*_\s*learning\s*_\s*evaluation\s*\}\}+",
                "{{r after_learning_evaluation }}",
            ),
        ]
        for pattern, replacement in replacements:
            normalized = re.sub(pattern, replacement, normalized)
        return normalized

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
        methods = self._stage_methods(journey, stage_name)
        if methods:
            parts.append("Method:")
            parts.extend(methods)
        if description:
            parts.append(f"Description: {description}")
        if content_lines:
            parts.append("Content:")
            parts.extend(content_lines)
        return "\n".join(parts) if parts else empty_message

    def _stage_value(self, journey: object, stage_name: str) -> dict[str, object] | None:
        if not isinstance(journey, dict):
            return None
        stage = journey.get(stage_name)
        return stage if isinstance(stage, dict) else None

    def _stage_duration(self, journey: object, stage_name: str) -> str:
        stage = self._stage_value(journey, stage_name)
        return self._normalize_export_text(str(stage.get("duration", ""))) if stage else ""

    def _stage_method(self, journey: object, stage_name: str) -> str:
        methods = self._stage_methods(journey, stage_name)
        return "\n".join(methods)

    def _stage_methods(self, journey: object, stage_name: str) -> list[str]:
        stage = self._stage_value(journey, stage_name)
        if not stage:
            return []
        raw_method = stage.get("method")
        if isinstance(raw_method, list):
            return [
                f"- {self._normalize_export_text(str(item))}"
                for item in raw_method
                if isinstance(item, str) and self._normalize_export_text(str(item))
            ]
        normalized = self._normalize_export_text(str(raw_method or ""))
        return [f"- {normalized}"] if normalized else []

    def _stage_content_list(self, journey: object, stage_name: str) -> str:
        stage = self._stage_value(journey, stage_name)
        if not stage:
            return ""
        content = stage.get("content")
        if not isinstance(content, list):
            return ""
        items = [
            f"- {self._normalize_export_text(str(item))}"
            for item in content
            if isinstance(item, str) and self._normalize_export_text(str(item))
        ]
        return "\n".join(items)

    def _stage_evaluation(self, journey: object, stage_name: str) -> str:
        content_lines = self._stage_content_list(journey, stage_name)
        if stage_name == "pre_learning":
            return (
                "Peserta menyelesaikan aktivitas persiapan awal dan menunjukkan pemahaman konsep dasar."
                if content_lines
                else "Peserta menuntaskan persiapan awal pembelajaran."
            )
        if stage_name == "classroom":
            return (
                "Peserta menunjukkan pemahaman melalui diskusi, latihan, dan demonstrasi pada sesi kelas."
                if content_lines
                else "Peserta menunjukkan pemahaman selama sesi kelas."
            )
        return (
            "Peserta menerapkan hasil belajar pada konteks kerja dan merefleksikan tindak lanjut yang disepakati."
            if content_lines
            else "Peserta menyiapkan tindak lanjut pascapembelajaran."
        )

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
