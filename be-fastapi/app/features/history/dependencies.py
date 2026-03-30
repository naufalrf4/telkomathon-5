from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.history.service import DecompositionService, HistoryService


def get_history_service(db: AsyncSession = Depends(get_db)) -> HistoryService:
    return HistoryService(db=db)


def get_decomposition_service(db: AsyncSession = Depends(get_db)) -> DecompositionService:
    return DecompositionService(db=db)
