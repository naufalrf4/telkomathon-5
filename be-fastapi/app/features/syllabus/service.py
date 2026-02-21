import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundException
from app.features.syllabus.generator import parse_syllabus_json
from app.features.syllabus.models import GeneratedSyllabus
from app.features.syllabus.schemas import SyllabusGenerateRequest


class SyllabusService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_syllabus_from_stream(
        self,
        request: SyllabusGenerateRequest,
        full_response: str,
    ) -> GeneratedSyllabus:
        parsed = parse_syllabus_json(full_response)
        syllabus = GeneratedSyllabus(
            topic=request.topic,
            target_level=request.target_level,
            tlo=str(parsed["tlo"]),
            elos=parsed["elos"],
            journey=parsed["journey"],
            source_doc_ids=[str(d) for d in request.doc_ids],
            revision_history=[],
            status="draft",
        )
        self.db.add(syllabus)
        await self.db.flush()
        await self.db.refresh(syllabus)
        return syllabus

    async def get_syllabi(self) -> list[GeneratedSyllabus]:
        result = await self.db.execute(
            select(GeneratedSyllabus).order_by(GeneratedSyllabus.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_syllabus(self, syllabus_id: uuid.UUID) -> GeneratedSyllabus:
        result = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return syllabus

    async def update_syllabus(
        self,
        syllabus_id: uuid.UUID,
        data: dict[str, object],
    ) -> GeneratedSyllabus:
        syllabus = await self.get_syllabus(syllabus_id)
        history: list[dict[str, object]] = list(syllabus.revision_history or [])
        snapshot: dict[str, object] = {
            "tlo": syllabus.tlo,
            "elos": syllabus.elos,
            "journey": syllabus.journey,
            "revised_at": datetime.utcnow().isoformat(),
        }
        history.append(snapshot)
        if "tlo" in data:
            syllabus.tlo = str(data["tlo"])
        if "elos" in data:
            setattr(syllabus, "elos", data["elos"])
        if "journey" in data:
            setattr(syllabus, "journey", data["journey"])
        setattr(syllabus, "revision_history", history)
        syllabus.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(syllabus)
        return syllabus
