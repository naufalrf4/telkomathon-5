import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import select

from app.exceptions import NotFoundException, ValidationException
from app.features.chat.models import ChatMessage
from app.features.syllabus.generator import parse_syllabus_json
from app.features.syllabus.models import GeneratedSyllabus
from app.features.syllabus.schemas import SyllabusGenerateRequest, SyllabusRevisionApplyRequest


class SyllabusService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def create_syllabus_from_stream(
        self,
        request: SyllabusGenerateRequest,
        full_response: str,
    ) -> GeneratedSyllabus:
        parsed = parse_syllabus_json(full_response)
        syllabus = GeneratedSyllabus(
            topic=request.topic,
            target_level=request.target_level,
            course_title=request.topic,
            tlo=str(parsed["tlo"]),
            performance_result=self._normalize_optional_text(parsed.get("performance_result")),
            condition_result=self._normalize_optional_text(parsed.get("condition_result")),
            standard_result=self._normalize_optional_text(parsed.get("standard_result")),
            elos=self._normalize_elos(parsed.get("elos")),
            journey=self._normalize_journey(parsed.get("journey")),
            source_doc_ids=[str(d) for d in request.doc_ids],
            revision_history=[],
            status="draft",
        )
        self.db.add(syllabus)
        await self.db.flush()
        await self.db.refresh(syllabus)
        return syllabus

    async def get_syllabi(self) -> list[GeneratedSyllabus]:
        result = await self.db.execute(
            select(GeneratedSyllabus).order_by(GeneratedSyllabus.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_syllabus(self, syllabus_id: uuid.UUID) -> GeneratedSyllabus:
        result = await self.db.execute(
            select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        )
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return cast(GeneratedSyllabus, syllabus)

    async def update_syllabus(
        self,
        syllabus_id: uuid.UUID,
        data: dict[str, object],
        *,
        summary: str = "",
        reason: str = "",
        source_message_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        syllabus = await self.get_syllabus(syllabus_id)
        applied_fields = [
            key
            for key in (
                "tlo",
                "performance_result",
                "condition_result",
                "standard_result",
                "elos",
                "journey",
            )
            if key in data
        ]
        if not applied_fields:
            raise ValidationException("At least one syllabus field must be updated")

        history: list[dict[str, object]] = list(syllabus.revision_history or [])
        history.append(
            {
                "tlo": syllabus.tlo,
                "performance_result": syllabus.performance_result or "",
                "condition_result": syllabus.condition_result or "",
                "standard_result": syllabus.standard_result or "",
                "elos": syllabus.elos,
                "journey": syllabus.journey,
                "revised_at": datetime.now(UTC).isoformat(),
                "summary": summary,
                "reason": reason,
                "source_message_id": str(source_message_id) if source_message_id else None,
                "applied_fields": applied_fields,
            }
        )

        if "tlo" in data:
            tlo_value = str(data["tlo"]).strip()
            if not tlo_value:
                raise ValidationException("tlo must not be empty")
            syllabus.tlo = tlo_value

        for field_name in ("performance_result", "condition_result", "standard_result"):
            if field_name in data:
                setattr(syllabus, field_name, self._normalize_optional_text(data[field_name]))

        if "elos" in data:
            syllabus.elos = self._normalize_elos(data["elos"])

        if "journey" in data:
            journey_value: dict[str, object] = self._normalize_journey(data["journey"])
            syllabus.journey = journey_value

        syllabus.revision_history = history
        syllabus.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(syllabus)
        return syllabus

    async def apply_revision(
        self,
        syllabus_id: uuid.UUID,
        request: SyllabusRevisionApplyRequest,
    ) -> GeneratedSyllabus:
        update_data: dict[str, object] = {}
        if request.tlo is not None:
            update_data["tlo"] = request.tlo
        if request.performance_result is not None:
            update_data["performance_result"] = request.performance_result
        if request.condition_result is not None:
            update_data["condition_result"] = request.condition_result
        if request.standard_result is not None:
            update_data["standard_result"] = request.standard_result
        if request.elos is not None:
            update_data["elos"] = [item.model_dump() for item in request.elos]
        if request.journey is not None:
            update_data["journey"] = request.journey.model_dump()

        syllabus = await self.update_syllabus(
            syllabus_id,
            update_data,
            summary=request.summary.strip(),
            reason=request.reason.strip(),
            source_message_id=request.source_message_id,
        )
        if request.source_message_id is not None:
            await self._mark_chat_revision_applied(
                syllabus_id=syllabus_id,
                message_id=request.source_message_id,
                summary=request.summary.strip(),
                reason=request.reason.strip(),
                applied_fields=list(update_data.keys()),
            )
        return syllabus

    async def create_finalized_syllabus(
        self,
        *,
        topic: str,
        target_level: int,
        course_category: str | None,
        client_company_name: str | None,
        course_title: str | None,
        company_profile_summary: str | None,
        commercial_overview: str | None,
        tlo: str,
        performance_result: str | None,
        condition_result: str | None,
        standard_result: str | None,
        elos: Sequence[dict[str, object]],
        source_doc_ids: Sequence[str],
    ) -> GeneratedSyllabus:
        syllabus = GeneratedSyllabus(
            topic=topic,
            target_level=target_level,
            course_category=self._normalize_optional_text(course_category),
            client_company_name=self._normalize_optional_text(client_company_name),
            course_title=self._normalize_optional_text(course_title) or topic,
            company_profile_summary=self._normalize_optional_text(company_profile_summary),
            commercial_overview=self._normalize_optional_text(commercial_overview),
            tlo=tlo,
            performance_result=self._normalize_optional_text(performance_result),
            condition_result=self._normalize_optional_text(condition_result),
            standard_result=self._normalize_optional_text(standard_result),
            elos=self._normalize_elos(elos),
            journey=self._build_default_journey(topic, tlo, performance_result),
            source_doc_ids=list(source_doc_ids),
            revision_history=[],
            status="finalized",
        )
        self.db.add(syllabus)
        await self.db.flush()
        await self.db.refresh(syllabus)
        return syllabus

    async def _mark_chat_revision_applied(
        self,
        *,
        syllabus_id: uuid.UUID,
        message_id: uuid.UUID,
        summary: str,
        reason: str,
        applied_fields: list[str],
    ) -> None:
        result = await self.db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
        message = result.scalar_one_or_none()
        if message is None:
            raise NotFoundException("Chat message", str(message_id))
        if message.syllabus_id != syllabus_id:
            raise ValidationException("Chat message does not belong to the target syllabus")
        message.revision_applied = {
            "applied_at": datetime.now(UTC).isoformat(),
            "summary": summary,
            "reason": reason,
            "applied_fields": applied_fields,
        }
        await self.db.flush()

    def _normalize_optional_text(self, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    def _normalize_elos(self, value: object) -> list[dict[str, object]]:
        if not isinstance(value, Sequence) or isinstance(value, str | bytes):
            raise ValidationException("elos must be a list")

        normalized: list[dict[str, object]] = []
        for item in value:
            if not isinstance(item, dict):
                raise ValidationException("Each ELO must be an object")
            elo_text = str(item.get("elo", "")).strip()
            if not elo_text:
                raise ValidationException("Each ELO must include non-empty elo text")
            normalized.append({"elo": elo_text})

        if not normalized:
            raise ValidationException("elos must not be empty")
        return normalized

    def _normalize_journey(self, value: object) -> dict[str, object]:
        raw = value if isinstance(value, dict) else {}
        return {
            "pre_learning": self._normalize_stage(raw.get("pre_learning"), "Pra-pembelajaran"),
            "classroom": self._normalize_stage(raw.get("classroom"), "Sesi kelas"),
            "after_learning": self._normalize_stage(
                raw.get("after_learning"), "Pasca-pembelajaran"
            ),
        }

    def _normalize_stage(self, value: object, fallback_description: str) -> dict[str, object]:
        if isinstance(value, dict):
            content_value = value.get("content")
            content = (
                [
                    str(item).strip()
                    for item in content_value
                    if isinstance(item, str) and str(item).strip()
                ]
                if isinstance(content_value, list)
                else []
            )
            return {
                "duration": str(value.get("duration", "")).strip(),
                "description": str(value.get("description", fallback_description)).strip(),
                "content": content,
            }

        if isinstance(value, Sequence) and not isinstance(value, str | bytes):
            content = [
                str(item).strip() for item in value if isinstance(item, str) and str(item).strip()
            ]
            return {
                "duration": "",
                "description": fallback_description,
                "content": content,
            }

        return {
            "duration": "",
            "description": fallback_description,
            "content": [],
        }

    def _build_default_journey(
        self,
        topic: str,
        tlo: str,
        performance_result: str | None,
    ) -> dict[str, object]:
        focus = self._normalize_optional_text(performance_result) or tlo
        return {
            "pre_learning": {
                "duration": "60 menit",
                "description": f"Peserta membangun konteks awal dan kosa kata utama untuk {topic}.",
                "content": [
                    f"Meninjau ringkasan perusahaan dan konteks bisnis terkait {topic}.",
                    f"Mengidentifikasi ekspektasi performa awal terhadap '{focus}'.",
                ],
            },
            "classroom": {
                "duration": "240 menit",
                "description": f"Peserta berlatih menerapkan {topic} melalui diskusi, demonstrasi, dan studi kasus terarah.",
                "content": [
                    f"Membedah TLO dan contoh penerapan {topic} pada konteks kerja.",
                    f"Latihan terstruktur untuk menunjukkan performa '{focus}'.",
                    "Umpan balik fasilitator dan refleksi hasil praktik peserta.",
                ],
            },
            "after_learning": {
                "duration": "120 menit",
                "description": f"Peserta mentransfer hasil belajar {topic} ke rencana aksi kerja nyata.",
                "content": [
                    f"Menyusun eksperimen penerapan {topic} di unit kerja masing-masing.",
                    "Melakukan review hasil awal bersama atasan, mentor, atau fasilitator.",
                ],
            },
        }
