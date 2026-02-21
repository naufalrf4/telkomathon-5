import asyncio
import uuid
from pathlib import Path

import weasyprint
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundException
from app.features.syllabus.models import GeneratedSyllabus

TEMPLATES_DIR = Path(__file__).parent / "templates"


class ExportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_pdf(self, syllabus_id: uuid.UUID) -> bytes:
        result = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))

        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        template = env.get_template("syllabus.html")
        html_content = template.render(
            topic=getattr(syllabus, "topic"),
            target_level=getattr(syllabus, "target_level"),
            tlo=getattr(syllabus, "tlo"),
            elos=getattr(syllabus, "elos") or [],
            journey=getattr(syllabus, "journey") or {},
            status=getattr(syllabus, "status"),
            created_at=getattr(syllabus, "created_at"),
        )

        result_bytes = await asyncio.to_thread(
            lambda: weasyprint.HTML(string=html_content).write_pdf()
        )
        if result_bytes is None:
            raise RuntimeError("WeasyPrint returned no PDF output")
        return result_bytes
