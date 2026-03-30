import uuid

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.chat.dependencies import get_chat_service
from app.features.chat.schemas import ChatMessageRequest
from app.features.chat.service import ChatService
from app.response import success_response

router = APIRouter(tags=["chat"])


@router.post("/{syllabus_id}/message")
async def send_message(
    syllabus_id: uuid.UUID,
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> EventSourceResponse:
    return EventSourceResponse(
        service.stream_revision(syllabus_id, request.content, owner_id=current_user.id)
    )


@router.get("/{syllabus_id}/history")
async def get_history(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> dict[str, object]:
    result = await service.get_history(syllabus_id, owner_id=current_user.id)
    return success_response(result.model_dump())
