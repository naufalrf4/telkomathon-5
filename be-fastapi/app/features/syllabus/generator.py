import json
from collections.abc import AsyncIterator
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.syllabus import build_syllabus_prompt
from app.ai.rag import build_context_block, retrieve_relevant_chunks
from app.exceptions import AIServiceException
from app.features.syllabus.schemas import SyllabusGenerateRequest


async def generate_syllabus_stream(
    request: SyllabusGenerateRequest,
    db: AsyncSession,
) -> AsyncIterator[str]:
    chunks = await retrieve_relevant_chunks(
        query=request.topic,
        doc_ids=request.doc_ids,
        db=db,
    )
    context = build_context_block(chunks)
    messages = build_syllabus_prompt(
        topic=request.topic,
        level=request.target_level,
        context=context,
        additional_context=request.additional_context,
    )
    try:
        stream = cast(AsyncIterator[str], await chat_complete(messages, stream=True))
        full_response = ""
        async for chunk in stream:
            full_response += chunk
            yield chunk
        yield f"\n__DONE__:{full_response}"
    except AIServiceException:
        raise
    except Exception as exc:
        raise AIServiceException(f"Syllabus generation failed: {exc}") from exc


def parse_syllabus_json(raw: str) -> dict[str, object]:
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object found")
        return cast(dict[str, object], json.loads(raw[start:end]))
    except (json.JSONDecodeError, ValueError) as exc:
        raise AIServiceException("Failed to parse syllabus JSON from LLM response") from exc
