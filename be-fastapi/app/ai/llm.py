import asyncio
from collections.abc import AsyncIterator
from typing import Union

from openai.types.chat import ChatCompletionMessageParam

from app.ai.client import get_azure_client
from app.config import settings
from app.exceptions import AIServiceException


async def chat_complete(
    messages: list[ChatCompletionMessageParam],
    stream: bool = False,
) -> Union[str, AsyncIterator[str]]:
    client = get_azure_client()
    try:
        if stream:
            return _stream_response(client, messages)
        response = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            messages=messages,
            stream=False,
        )
        content = response.choices[0].message.content
        return content or ""
    except Exception as exc:
        raise AIServiceException(f"LLM completion failed: {exc}") from exc


async def _stream_response(
    client,
    messages: list[ChatCompletionMessageParam],
) -> AsyncIterator[str]:
    try:
        stream = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as exc:
        raise AIServiceException(f"LLM stream failed: {exc}") from exc
