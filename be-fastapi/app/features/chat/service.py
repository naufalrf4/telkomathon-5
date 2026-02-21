import uuid
from collections.abc import AsyncIterator
from typing import cast

from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.chat import build_revision_prompt
from app.exceptions import NotFoundException
from app.features.chat.models import ChatMessage
from app.features.chat.schemas import ChatHistoryResponse, ChatMessageResponse
from app.features.syllabus.models import GeneratedSyllabus


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_history(self, syllabus_id: uuid.UUID) -> ChatHistoryResponse:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.syllabus_id == syllabus_id)
            .order_by(ChatMessage.created_at.asc())
        )
        messages = list(result.scalars().all())
        return ChatHistoryResponse(
            messages=[ChatMessageResponse.model_validate(m) for m in messages],
            total=len(messages),
        )

    async def stream_revision(
        self,
        syllabus_id: uuid.UUID,
        content: str,
    ) -> AsyncIterator[str]:
        result_row = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result_row.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))

        history_result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.syllabus_id == syllabus_id)
            .order_by(ChatMessage.created_at.asc())
        )
        history_rows = list(history_result.scalars().all())
        conversation_history: list[ChatCompletionMessageParam] = cast(
            list[ChatCompletionMessageParam],
            [{"role": m.role, "content": m.content} for m in history_rows],
        )

        user_msg = ChatMessage()
        setattr(user_msg, "syllabus_id", syllabus_id)
        setattr(user_msg, "role", "user")
        setattr(user_msg, "content", content)
        setattr(user_msg, "revision_applied", None)
        self.db.add(user_msg)
        await self.db.flush()

        syllabus_dict = {
            "tlo": getattr(syllabus, "tlo"),
            "elos": getattr(syllabus, "elos"),
            "journey": getattr(syllabus, "journey"),
        }
        messages = cast(
            list[ChatCompletionMessageParam],
            build_revision_prompt(syllabus_dict, content, conversation_history),
        )
        stream = cast(AsyncIterator[str], await chat_complete(messages, stream=True))

        full_response = ""
        async for chunk in stream:
            full_response += chunk
            yield chunk

        assistant_msg = ChatMessage()
        setattr(assistant_msg, "syllabus_id", syllabus_id)
        setattr(assistant_msg, "role", "assistant")
        setattr(assistant_msg, "content", full_response)
        setattr(assistant_msg, "revision_applied", None)
        self.db.add(assistant_msg)
        await self.db.flush()

        yield "__DONE__"
