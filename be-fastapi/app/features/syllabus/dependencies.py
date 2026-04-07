from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.syllabus.revision_service import RevisionChatService
from app.features.syllabus.service import SyllabusService


def get_syllabus_service(db: AsyncSession = Depends(get_db)) -> SyllabusService:
    return SyllabusService(db=db)


def get_revision_chat_service(
    db: AsyncSession = Depends(get_db),
) -> RevisionChatService:
    return RevisionChatService(db=db)
