"""Chat-based syllabus revision service."""

import uuid
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.ai.llm import chat_complete_json
from app.ai.prompts.revision import (
    build_revision_rewrite_prompt,
    build_revision_routing_prompt,
)
from app.exceptions import NotFoundException, ValidationException
from app.features.syllabus.models import GeneratedSyllabus, RevisionMessage
from app.features.syllabus.schemas import (
    ELO,
    LearningJourney,
    LearningJourneyStage,
    SyllabusRevisionApplyRequest,
)
from app.features.syllabus.service import SyllabusService

_NON_REVISION_REPLY = (
    "Saya hanya dapat membantu dengan revisi silabus. "
    "Silakan sampaikan bagian mana dari silabus yang ingin Anda ubah, "
    "misalnya: 'Ubah TLO agar lebih fokus pada analisis data' atau "
    "'Tambahkan metode diskusi pada sesi classroom'."
)


class RevisionChatService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db
        self.syllabus_service = SyllabusService(db)

    async def send_message(
        self,
        syllabus_id: uuid.UUID,
        user_message: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> RevisionMessage:
        # 1. Load syllabus (owner-scoped)
        syllabus = await self.syllabus_service.get_syllabus(syllabus_id, owner_id=owner_id)

        # 2. Fetch recent conversation history for context
        recent_history = await self._get_recent_messages(syllabus_id, limit=10)

        # 3. Save user message to DB
        user_msg = RevisionMessage(
            syllabus_id=syllabus_id,
            role="user",
            content=user_message,
            status="pending",
        )
        self.db.add(user_msg)
        try:
            await self.db.flush()
        except SQLAlchemyError as exc:
            if self._is_revision_message_storage_error(exc):
                raise ValidationException(
                    "Workspace revisi chat belum siap. Jalankan migrasi database terbaru terlebih dahulu."
                ) from exc
            raise

        # 4. Build syllabus outline, call routing prompt with conversation context
        outline = self._build_syllabus_outline(syllabus)
        routing_messages = build_revision_routing_prompt(
            user_message, outline, conversation_history=recent_history
        )
        routing_result = await chat_complete_json(routing_messages)

        is_revision: bool = bool(routing_result.get("is_revision", False))

        # 4. If not a revision request, save polite decline
        if not is_revision:
            assistant_msg = RevisionMessage(
                syllabus_id=syllabus_id,
                role="assistant",
                content=_NON_REVISION_REPLY,
                status="pending",
            )
            self.db.add(assistant_msg)
            try:
                await self.db.flush()
            except SQLAlchemyError as exc:
                if self._is_revision_message_storage_error(exc):
                    raise ValidationException(
                        "Workspace revisi chat belum siap. Jalankan migrasi database terbaru terlebih dahulu."
                    ) from exc
                raise
            await self.db.refresh(assistant_msg)
            return assistant_msg

        # 5. Extract current values for targeted sections
        target_sections: list[str] = [str(s) for s in routing_result.get("target_sections", [])]
        if not target_sections:
            target_sections = ["tlo"]

        instruction: str = str(routing_result.get("instructions", user_message))
        current_values = self._extract_current_values(syllabus, target_sections)

        # 6. Call rewriter prompt
        syllabus_context: dict[str, str] = {
            "topic": syllabus.topic,
            "tlo": syllabus.tlo,
            "level": str(syllabus.target_level),
        }
        rewrite_messages = build_revision_rewrite_prompt(
            instruction, target_sections, current_values, syllabus_context
        )
        rewrite_result = await chat_complete_json(rewrite_messages)
        proposed_changes_raw: dict[str, object] = cast(
            dict[str, object], rewrite_result.get("revised_sections", {})
        )
        proposed_changes = self._filter_meaningful_changes(current_values, proposed_changes_raw)

        if not proposed_changes:
            retry_messages = build_revision_rewrite_prompt(
                (
                    instruction
                    + "\n\nPENTING: hasil revisi harus berbeda secara nyata dari nilai saat ini pada setiap bagian yang ditargetkan. "
                    + "Jangan kembalikan teks yang sama."
                ),
                target_sections,
                current_values,
                syllabus_context,
            )
            retry_result = await chat_complete_json(retry_messages)
            retry_proposed_changes: dict[str, object] = cast(
                dict[str, object], retry_result.get("revised_sections", {})
            )
            proposed_changes = self._filter_meaningful_changes(
                current_values, retry_proposed_changes
            )

        if not proposed_changes:
            raise ValidationException(
                "AI belum menghasilkan revisi yang berbeda dari versi saat ini. Coba beri instruksi yang lebih spesifik."
            )

        target_sections = [section for section in target_sections if section in proposed_changes]

        # 7. Build assistant response content
        change_summary_parts: list[str] = []
        for section_key in target_sections:
            if section_key in proposed_changes:
                change_summary_parts.append(f"- **{section_key}**: direvisi")
        content = (
            "Saya telah menyiapkan revisi untuk bagian berikut:\n"
            + "\n".join(change_summary_parts)
            + "\n\nSilakan tinjau perubahan dan pilih 'Terima' atau 'Tolak'."
        )

        # 8. Save assistant message with proposed_changes
        assistant_msg = RevisionMessage(
            syllabus_id=syllabus_id,
            role="assistant",
            content=content,
            target_sections=target_sections,
            proposed_changes=proposed_changes,
            section_statuses={section_key: "pending" for section_key in target_sections},
            status="pending",
        )
        self.db.add(assistant_msg)
        try:
            await self.db.flush()
        except SQLAlchemyError as exc:
            if self._is_revision_message_storage_error(exc):
                raise ValidationException(
                    "Workspace revisi chat belum siap. Jalankan migrasi database terbaru terlebih dahulu."
                ) from exc
            raise
        await self.db.refresh(assistant_msg)
        return assistant_msg

    async def accept_revision(
        self,
        syllabus_id: uuid.UUID,
        message_id: uuid.UUID,
        section_key: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        message = await self._get_message(syllabus_id, message_id)
        self._ensure_actionable_assistant_message(message)
        proposed_change = self._get_pending_section_change(message, section_key)

        syllabus = await self.syllabus_service.get_syllabus(syllabus_id, owner_id=owner_id)

        summary = await self._get_preceding_user_content(syllabus_id, message)
        revision_request = self._build_revision_request(
            {section_key: proposed_change}, summary, current_journey=syllabus.journey
        )
        revision_request.source_message_id = message_id

        syllabus = await self.syllabus_service.apply_revision(
            syllabus_id, revision_request, owner_id=owner_id
        )

        section_statuses = self._get_section_statuses(message)
        section_statuses[section_key] = "accepted"
        message.section_statuses = section_statuses
        message.status = self._aggregate_message_status(section_statuses)
        await self.db.flush()

        return syllabus

    async def reject_revision(
        self,
        syllabus_id: uuid.UUID,
        message_id: uuid.UUID,
        section_key: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> RevisionMessage:
        await self.syllabus_service.get_syllabus(syllabus_id, owner_id=owner_id)

        message = await self._get_message(syllabus_id, message_id)
        self._ensure_actionable_assistant_message(message)
        self._get_pending_section_change(message, section_key)

        section_statuses = self._get_section_statuses(message)
        section_statuses[section_key] = "rejected"
        message.section_statuses = section_statuses
        message.status = self._aggregate_message_status(section_statuses)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def get_history(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> list[RevisionMessage]:
        # 1. Verify syllabus exists and is owned
        await self.syllabus_service.get_syllabus(syllabus_id, owner_id=owner_id)

        # 2. Query all messages ordered by created_at
        query = (
            select(RevisionMessage)
            .where(RevisionMessage.syllabus_id == syllabus_id)
            .order_by(RevisionMessage.created_at.asc())
        )
        try:
            result = await self.db.execute(query)
        except SQLAlchemyError as exc:
            if self._is_revision_message_storage_error(exc):
                return []
            raise
        return list(result.scalars().all())

    # ---------- Private helpers ----------

    def _build_syllabus_outline(self, syllabus: GeneratedSyllabus) -> dict[str, object]:
        elos_list: list[dict[str, object]] = syllabus.elos or []
        journey_data: dict[str, object] = syllabus.journey or {}
        return {
            "tlo": str(syllabus.tlo)[:150],
            "performance_result": str(syllabus.performance_result or "")[:150],
            "condition_result": str(syllabus.condition_result or "")[:150],
            "standard_result": str(syllabus.standard_result or "")[:150],
            "elos": [str(e.get("elo", ""))[:80] for e in elos_list if isinstance(e, dict)],
            "journey": {
                stage: str(
                    stage_data.get("description", "") if isinstance(stage_data, dict) else ""
                )[:100]
                for stage in ("pre_learning", "classroom", "after_learning")
                for stage_data in [journey_data.get(stage, {})]
            },
        }

    def _extract_current_values(
        self, syllabus: GeneratedSyllabus, sections: list[str]
    ) -> dict[str, object]:
        values: dict[str, object] = {}
        journey_data: dict[str, object] = syllabus.journey or {}
        for section in sections:
            if section.startswith("journey."):
                stage_key = section.split(".", 1)[1]
                values[section] = journey_data.get(stage_key, {})
            elif section == "elos":
                values["elos"] = syllabus.elos
            else:
                values[section] = getattr(syllabus, section, "")
        return values

    def _build_revision_request(
        self,
        proposed_changes: dict[str, object],
        summary: str,
        *,
        current_journey: dict[str, object] | None = None,
    ) -> SyllabusRevisionApplyRequest:
        flat_fields: dict[str, Any] = {"summary": summary, "reason": "chat_revision"}

        # Collect journey substage changes
        journey_stages: dict[str, object] = {}
        for key, value in proposed_changes.items():
            if key.startswith("journey."):
                stage_key = key.split(".", 1)[1]
                journey_stages[stage_key] = value
            elif key == "elos" and isinstance(value, list):
                flat_fields["elos"] = [
                    ELO(elo=str(e.get("elo", "") if isinstance(e, dict) else e)) for e in value
                ]
            elif key in (
                "tlo",
                "performance_result",
                "condition_result",
                "standard_result",
            ):
                flat_fields[key] = str(value)

        if journey_stages:
            # Merge changed stages with current values for unchanged stages
            existing = current_journey or {}
            flat_fields["journey"] = LearningJourney(
                pre_learning=self._coerce_stage(
                    journey_stages.get("pre_learning", existing.get("pre_learning"))
                ),
                classroom=self._coerce_stage(
                    journey_stages.get("classroom", existing.get("classroom"))
                ),
                after_learning=self._coerce_stage(
                    journey_stages.get("after_learning", existing.get("after_learning"))
                ),
            )

        return SyllabusRevisionApplyRequest(**flat_fields)

    def _filter_meaningful_changes(
        self,
        current_values: dict[str, object],
        proposed_changes: dict[str, object],
    ) -> dict[str, object]:
        filtered: dict[str, object] = {}
        for key, proposed_value in proposed_changes.items():
            current_value = current_values.get(key)
            if not self._section_values_equal(current_value, proposed_value):
                filtered[key] = proposed_value
        return filtered

    def _section_values_equal(self, current_value: object, proposed_value: object) -> bool:
        return self._normalize_section_value(current_value) == self._normalize_section_value(
            proposed_value
        )

    def _normalize_section_value(self, value: object) -> object:
        if isinstance(value, str):
            return " ".join(value.split())

        if isinstance(value, list):
            normalized_items: list[object] = []
            for item in value:
                if isinstance(item, dict):
                    if "elo" in item:
                        normalized_items.append({"elo": " ".join(str(item.get("elo", "")).split())})
                    else:
                        normalized_items.append(self._normalize_section_value(item))
                else:
                    normalized_items.append(self._normalize_section_value(item))
            return normalized_items

        if isinstance(value, dict):
            return {
                str(key): self._normalize_section_value(item_value)
                for key, item_value in sorted(value.items())
            }

        return value

    def _coerce_stage(self, value: object) -> LearningJourneyStage:
        if isinstance(value, dict):
            return LearningJourneyStage(
                duration=str(value.get("duration", "")),
                method=[str(m) for m in value.get("method", []) if isinstance(m, str)]
                if isinstance(value.get("method"), list)
                else [],
                description=str(value.get("description", "")),
                content=[str(c) for c in value.get("content", []) if isinstance(c, str)]
                if isinstance(value.get("content"), list)
                else [],
            )
        return LearningJourneyStage()

    def _ensure_actionable_assistant_message(self, message: RevisionMessage) -> None:
        if message.role != "assistant":
            raise ValidationException("Only assistant messages can be acted on")
        if message.proposed_changes is None:
            raise ValidationException("Message has no proposed changes")

    def _get_section_statuses(self, message: RevisionMessage) -> dict[str, str]:
        proposed_changes = message.proposed_changes or {}
        raw_statuses = (
            message.section_statuses if isinstance(message.section_statuses, dict) else {}
        )
        default_status = message.status if message.status in {"accepted", "rejected"} else "pending"
        return {
            str(section_key): str(raw_statuses.get(section_key, default_status))
            for section_key in proposed_changes
        }

    def _get_pending_section_change(self, message: RevisionMessage, section_key: str) -> object:
        proposed_changes = message.proposed_changes or {}
        if section_key not in proposed_changes:
            raise ValidationException(f"Section '{section_key}' not found in this revision message")

        section_statuses = self._get_section_statuses(message)
        current_status = section_statuses.get(section_key, "pending")
        if current_status != "pending":
            raise ValidationException(
                f"Section '{section_key}' already {current_status}, cannot be changed again"
            )

        return proposed_changes[section_key]

    def _aggregate_message_status(self, section_statuses: dict[str, str]) -> str:
        statuses = set(section_statuses.values())
        if not statuses or statuses == {"pending"}:
            return "pending"
        if statuses == {"accepted"}:
            return "accepted"
        if statuses == {"rejected"}:
            return "rejected"
        return "partial"

    async def _get_message(self, syllabus_id: uuid.UUID, message_id: uuid.UUID) -> RevisionMessage:
        query = select(RevisionMessage).where(
            RevisionMessage.id == message_id,
            RevisionMessage.syllabus_id == syllabus_id,
        )
        result = await self.db.execute(query)
        message = result.scalar_one_or_none()
        if message is None:
            raise NotFoundException("RevisionMessage", str(message_id))
        return cast(RevisionMessage, message)

    async def _get_preceding_user_content(
        self, syllabus_id: uuid.UUID, assistant_msg: RevisionMessage
    ) -> str:
        """Get the user message that preceded this assistant message."""
        query = (
            select(RevisionMessage)
            .where(
                RevisionMessage.syllabus_id == syllabus_id,
                RevisionMessage.role == "user",
                RevisionMessage.created_at <= assistant_msg.created_at,
            )
            .order_by(RevisionMessage.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        user_msg = result.scalar_one_or_none()
        if user_msg is not None:
            return str(cast(RevisionMessage, user_msg).content)
        return "Chat revision"

    async def _get_recent_messages(
        self, syllabus_id: uuid.UUID, *, limit: int = 10
    ) -> list[dict[str, str]]:
        """Fetch recent conversation messages for context injection."""
        query = (
            select(RevisionMessage)
            .where(RevisionMessage.syllabus_id == syllabus_id)
            .order_by(RevisionMessage.created_at.desc())
            .limit(limit)
        )
        try:
            result = await self.db.execute(query)
        except SQLAlchemyError as exc:
            if self._is_revision_message_storage_error(exc):
                return []
            raise
        messages = list(result.scalars().all())
        messages.reverse()
        return [{"role": msg.role, "content": msg.content[:300]} for msg in messages]

    def _is_revision_message_storage_error(self, exc: SQLAlchemyError) -> bool:
        return "revision_messages" in str(exc).lower()
