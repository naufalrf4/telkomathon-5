from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.syllabus.service import SyllabusService


def get_syllabus_service(db: AsyncSession = Depends(get_db)) -> SyllabusService:
    return SyllabusService(db=db)
