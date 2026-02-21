from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.documents.service import DocumentService


async def get_document_service(
    db: AsyncSession = Depends(get_db),
) -> DocumentService:
    return DocumentService(db)
