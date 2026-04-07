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
        _validate_finish_reason(response.choices[0].finish_reason if response.choices else None)
        content = response.choices[0].message.content
        return content or ""
    except Exception as exc:
        raise AIServiceException(
            _format_azure_error(
                "LLM completion failed",
                exc,
                deployment=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            )
        ) from exc


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
        _validate_finish_reason(response.choices[0].finish_reason if response.choices else None)
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("LLM JSON response must be an object")
        return parsed
    except Exception as exc:
        raise AIServiceException(
            _format_azure_error(
                "LLM JSON completion failed",
                exc,
                deployment=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            )
        ) from exc


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
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            _validate_finish_reason(choice.finish_reason)
            delta = choice.delta.content
            if delta:
                yield delta
    except Exception as exc:
        raise AIServiceException(
            _format_azure_error(
                "LLM stream failed",
                exc,
                deployment=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            )
        ) from exc


def _validate_finish_reason(finish_reason: str | None) -> None:
    if finish_reason == "content_filter":
        raise AIServiceException("LLM response blocked by content filter")
    if finish_reason == "length":
        raise AIServiceException("LLM response truncated before completion")


def _format_azure_error(prefix: str, exc: Exception, *, deployment: str) -> str:
    return (
        f"{prefix}: {exc} | azure_endpoint={settings.AZURE_OPENAI_ENDPOINT} "
        f"| api_version={settings.AZURE_OPENAI_API_VERSION} | deployment={deployment}"
    )
