from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.features.chat.service import ChatService


def get_chat_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    return ChatService(db)
