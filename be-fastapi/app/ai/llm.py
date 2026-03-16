import json
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncAzureOpenAI
from openai.types.chat import ChatCompletionMessageParam

from app.ai.client import get_azure_client
from app.config import settings
from app.exceptions import AIServiceException


async def chat_complete(
    messages: list[ChatCompletionMessageParam],
    stream: bool = False,
) -> str | AsyncIterator[str]:
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


async def chat_complete_json(
    messages: list[ChatCompletionMessageParam],
) -> dict[str, Any]:
    client = get_azure_client()
    try:
        response = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            messages=messages,
            response_format={"type": "json_object"},
            stream=False,
        )
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("LLM JSON response must be an object")
        return parsed
    except Exception as exc:
        raise AIServiceException(f"LLM JSON completion failed: {exc}") from exc


async def _stream_response(
    client: AsyncAzureOpenAI,
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
