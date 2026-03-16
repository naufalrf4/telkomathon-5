from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.design_sessions.service import DesignSessionService


def get_design_session_service(
    db: AsyncSession = Depends(get_db),
) -> DesignSessionService:
    return DesignSessionService(db)
