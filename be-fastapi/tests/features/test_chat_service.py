from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AIServiceException
from app.features.chat.models import ChatMessage
from app.features.chat.service import ChatService
from app.features.syllabus.models import GeneratedSyllabus


class FakeScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalars(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[object]:
        if isinstance(self.value, list):
            return self.value
        return []


class FakeChatSession:
    def __init__(self, syllabus: GeneratedSyllabus, history: list[ChatMessage]) -> None:
        self.syllabus = syllabus
        self.history = history
        self.added: list[object] = []
        self.commit_calls = 0

    async def execute(self, statement: object) -> FakeScalarResult:
        statement_text = str(statement)
        if "chat_messages" in statement_text:
            return FakeScalarResult(self.history)
        return FakeScalarResult(self.syllabus)

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        self.commit_calls += 1


@pytest.mark.asyncio
async def test_stream_revision_falls_back_when_llm_stream_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    syllabus = GeneratedSyllabus(
        id=uuid4(),
        topic="Literasi Digital",
        target_level=3,
        tlo="TLO aktif",
        performance_result="Performance aktif",
        condition_result="Condition aktif",
        standard_result="Standard aktif",
        elos=[{"elo": "Menjelaskan prinsip keamanan digital dasar."}],
        journey={
            "pre_learning": {
                "duration": "30 menit",
                "description": "Pengantar konsep dasar",
                "content": ["Membaca ringkasan kebijakan digital"],
            },
            "classroom": {
                "duration": "1 hari",
                "description": "Workshop studi kasus",
                "content": ["Latihan kasus keamanan digital"],
            },
            "after_learning": {
                "duration": "1 minggu",
                "description": "Implementasi di tempat kerja",
                "content": ["Menyusun tindak lanjut tim"],
            },
        },
        source_doc_ids=[],
        revision_history=[],
        status="finalized",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeChatSession(syllabus, [])
    service = ChatService(db=cast(AsyncSession, cast(object, db)))

    async def fake_chat_complete(*_: Any, **__: Any) -> str:
        raise AIServiceException("DeploymentNotFound")

    monkeypatch.setattr("app.features.chat.service.chat_complete", fake_chat_complete)

    chunks: list[str] = []
    async for chunk in service.stream_revision(syllabus.id, "Tolong revisi"):
        chunks.append(chunk)

    assert len(chunks) == 2
    assert chunks[0].startswith("Saran revisi sementara (fallback):")
    assert "TLO saat ini: TLO aktif" in chunks[0]
    assert "Performance: Performance aktif" in chunks[0]
    assert chunks[1] == "__DONE__"

    assistant_messages = [
        item for item in db.added if isinstance(item, ChatMessage) and item.role == "assistant"
    ]
    assert assistant_messages
    assert assistant_messages[-1].content == chunks[0]
    assert db.commit_calls == 1
