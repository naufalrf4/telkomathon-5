import json
from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AIServiceException
from app.features.syllabus.generator import generate_syllabus_stream
from app.features.syllabus.schemas import SyllabusGenerateRequest


@pytest.mark.asyncio
async def test_generate_syllabus_stream_falls_back_on_ai_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_retrieve_relevant_chunks(**_: Any) -> list[dict[str, object]]:
        return []

    def fake_build_context_block(_: list[dict[str, object]]) -> str:
        return ""

    def fake_build_syllabus_prompt(**_: Any) -> list[dict[str, str]]:
        return [{"role": "user", "content": "test"}]

    async def fake_chat_complete(*_: Any, **__: Any) -> AsyncIterator[str]:
        raise AIServiceException("DeploymentNotFound")

    monkeypatch.setattr(
        "app.features.syllabus.generator.retrieve_relevant_chunks",
        fake_retrieve_relevant_chunks,
    )
    monkeypatch.setattr(
        "app.features.syllabus.generator.build_context_block",
        fake_build_context_block,
    )
    monkeypatch.setattr(
        "app.features.syllabus.generator.build_syllabus_prompt",
        fake_build_syllabus_prompt,
    )
    monkeypatch.setattr(
        "app.features.syllabus.generator.chat_complete",
        fake_chat_complete,
    )

    request = SyllabusGenerateRequest(
        topic="Audit Flow",
        target_level=3,
        doc_ids=[uuid4()],
        additional_context="Need resilient fallback",
    )

    chunks: list[str] = []
    fake_db = cast(AsyncSession, object())
    async for chunk in generate_syllabus_stream(request, db=fake_db):
        chunks.append(chunk)

    assert len(chunks) == 2
    payload = json.loads(chunks[0])
    assert payload["generation_notes"]["mode"] == "fallback"
    assert "DeploymentNotFound" in str(payload["generation_notes"]["reason"])
    assert payload["tlo"].startswith("Peserta mampu menerapkan prinsip utama Audit Flow")
    assert len(payload["elos"]) == 5
    assert chunks[1].startswith("\n__DONE__:")
