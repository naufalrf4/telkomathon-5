import uuid
from collections.abc import AsyncIterator
from typing import cast

from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.chat import build_revision_prompt
from app.exceptions import AIServiceException, NotFoundException
from app.features.chat.models import ChatMessage
from app.features.chat.schemas import ChatHistoryResponse, ChatMessageResponse
from app.features.syllabus.models import GeneratedSyllabus


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db: AsyncSession = db

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
        conversation_history: list[ChatCompletionMessageParam] = []
        for message_row in history_rows:
            if message_row.role == "assistant":
                message = cast(
                    ChatCompletionMessageParam,
                    cast(object, {"role": "assistant", "content": message_row.content}),
                )
            else:
                message = cast(
                    ChatCompletionMessageParam,
                    cast(object, {"role": "user", "content": message_row.content}),
                )
            conversation_history.append(message)

        user_msg = ChatMessage()
        user_msg.syllabus_id = syllabus_id
        user_msg.role = "user"
        user_msg.content = content
        user_msg.revision_applied = None
        self.db.add(user_msg)
        await self.db.flush()

        syllabus_dict: dict[str, object] = {
            "tlo": syllabus.tlo,
            "elos": syllabus.elos,
            "journey": syllabus.journey,
        }
        messages = build_revision_prompt(syllabus_dict, content, conversation_history)
        stream_response = await chat_complete(messages, stream=True)
        if isinstance(stream_response, str):
            raise AIServiceException("Unexpected non-streaming response from LLM")
        stream: AsyncIterator[str] = stream_response

        full_response = ""
        async for chunk in stream:
            full_response += chunk
            yield chunk

        assistant_msg = ChatMessage()
        assistant_msg.syllabus_id = syllabus_id
        assistant_msg.role = "assistant"
        assistant_msg.content = full_response
        assistant_msg.revision_applied = None
        self.db.add(assistant_msg)
        await self.db.flush()

        yield "__DONE__"
