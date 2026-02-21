from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.personalize.service import PersonalizeService


def get_personalize_service(db: AsyncSession = Depends(get_db)) -> PersonalizeService:
    return PersonalizeService(db)
