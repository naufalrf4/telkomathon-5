"""Service layer for owner-scoped history aggregation, CSV export,
and post-finalize module decomposition.

Business rules
--------------
* History events are append-only; there is no mutation of past rows.
* Module decomposition is a *derived* artefact produced only after a
  syllabus has been finalized.  When the source syllabus is mutated
  (revision-apply), all derived decompositions for that syllabus MUST
  be deleted so they never go stale.
* CSV export pulls from persisted OwnerHistory + PersonalizationResult
  rows; it does not reconstruct from transient state.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select

from app.exceptions import NotFoundException, ValidationException
from app.features.chat.models import ChatMessage
from app.features.history.models import ModuleDecomposition, OwnerHistory
from app.features.history.schemas import (
    OwnerHistoryAggregation,
    RevisionDownstreamSummary,
    RevisionNoteResponse,
    RevisionSnapshot,
)
from app.features.personalize.models import PersonalizationResult
from app.features.roadmap.models import CareerRoadmapResult
from app.features.syllabus.models import GeneratedSyllabus


class HistoryService:
    """Owner-scoped history aggregation and CSV export."""

    def __init__(self, db: Any) -> None:
        self.db: Any = db

    # ----- record events ---------------------------------------------------

    async def record_event(
        self,
        *,
        syllabus_id: uuid.UUID,
        action: str,
        owner_id: str = "default",
        summary: str = "",
        detail: dict[str, object] | None = None,
        revision_index: int | None = None,
    ) -> OwnerHistory:
        entry = OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=owner_id,
            action=action,
            summary=summary,
            detail=detail or {},
            revision_index=revision_index,
        )
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    # ----- queries ---------------------------------------------------------

    async def get_history_for_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: str,
    ) -> list[OwnerHistory]:
        stmt = (
            select(OwnerHistory)
            .where(OwnerHistory.syllabus_id == syllabus_id)
            .order_by(OwnerHistory.created_at.asc())
        )
        stmt = stmt.where(OwnerHistory.owner_id == owner_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def aggregate(
        self,
        *,
        owner_id: str = "default",
        syllabus_id: uuid.UUID | None = None,
    ) -> OwnerHistoryAggregation:
        stmt = select(
            OwnerHistory.action,
            func.count().label("cnt"),
            func.min(OwnerHistory.created_at).label("first_at"),
            func.max(OwnerHistory.created_at).label("last_at"),
        ).where(OwnerHistory.owner_id == owner_id)

        if syllabus_id is not None:
            stmt = stmt.where(OwnerHistory.syllabus_id == syllabus_id)

        stmt = stmt.group_by(OwnerHistory.action)
        result = await self.db.execute(stmt)
        rows = result.all()

        action_counts: dict[str, int] = {}
        first_event: datetime | None = None
        last_event: datetime | None = None
        total = 0

        for row in rows:
            action_counts[row.action] = row.cnt
            total += row.cnt
            if first_event is None or row.first_at < first_event:
                first_event = row.first_at
            if last_event is None or row.last_at > last_event:
                last_event = row.last_at

        return OwnerHistoryAggregation(
            owner_id=owner_id,
            syllabus_id=syllabus_id,
            action_counts=action_counts,
            first_event=first_event,
            last_event=last_event,
            total_events=total,
        )

    # ----- CSV export ------------------------------------------------------

    async def export_history_csv(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: str | None = None,
    ) -> str:
        """Return CSV text for all history events + personalization data
        associated with *syllabus_id*.
        """
        if owner_id is None:
            events = await self.get_history_for_syllabus(syllabus_id, owner_id="default")
        else:
            events = await self.get_history_for_syllabus(syllabus_id, owner_id=owner_id)

        # Pull all personalization recommendations if any
        pers_result = await self.db.execute(
            select(PersonalizationResult)
            .where(PersonalizationResult.syllabus_id == syllabus_id)
            .order_by(PersonalizationResult.created_at.asc())
        )
        personalizations = list(pers_result.scalars().all())
        roadmap_result = await self.db.execute(
            select(CareerRoadmapResult)
            .where(CareerRoadmapResult.syllabus_id == syllabus_id)
            .order_by(CareerRoadmapResult.created_at.asc())
        )
        roadmaps = list(roadmap_result.scalars().all())

        buf = io.StringIO()
        writer = csv.writer(buf)

        # Section 1 – history
        writer.writerow(
            [
                "section",
                "id",
                "syllabus_id",
                "owner_id",
                "action",
                "summary",
                "revision_index",
                "created_at",
            ]
        )
        for ev in events:
            writer.writerow(
                [
                    "history",
                    str(ev.id),
                    str(ev.syllabus_id),
                    ev.owner_id,
                    ev.action,
                    ev.summary,
                    ev.revision_index if ev.revision_index is not None else "",
                    ev.created_at.isoformat() if ev.created_at else "",
                ]
            )

        # Section 2 – recommendations (if persisted)
        if personalizations:
            writer.writerow([])  # blank separator
            writer.writerow(
                [
                    "section",
                    "participant_name",
                    "bulk_session_id",
                    "revision_index",
                    "type",
                    "title",
                    "description",
                    "estimated_duration_minutes",
                    "priority",
                ]
            )
            for personalization in personalizations:
                writer.writerow(
                    [
                        "personalization",
                        personalization.participant_name,
                        personalization.bulk_session_id or "",
                        personalization.revision_index,
                        "summary",
                        "Personalization run",
                        f"Stored personalization for {personalization.participant_name}",
                        "",
                        "",
                    ]
                )
                for rec in personalization.recommendations or []:
                    writer.writerow(
                        [
                            "recommendation",
                            personalization.participant_name,
                            personalization.bulk_session_id or "",
                            personalization.revision_index,
                            rec.get("type", ""),
                            rec.get("title", ""),
                            rec.get("description", ""),
                            rec.get("estimated_duration_minutes", ""),
                            rec.get("priority", ""),
                        ]
                    )

        if roadmaps:
            writer.writerow([])
            writer.writerow(
                [
                    "section",
                    "participant_name",
                    "revision_index",
                    "current_role",
                    "target_role",
                    "time_horizon_weeks",
                    "phase_title",
                    "timeframe",
                    "objective",
                    "success_indicator",
                ]
            )
            for roadmap in roadmaps:
                if not roadmap.milestones:
                    writer.writerow(
                        [
                            "roadmap",
                            roadmap.participant_name,
                            roadmap.revision_index,
                            roadmap.current_role,
                            roadmap.target_role,
                            roadmap.time_horizon_weeks,
                            "",
                            "",
                            "",
                            "",
                        ]
                    )
                    continue
                for milestone in roadmap.milestones:
                    if not isinstance(milestone, dict):
                        continue
                    writer.writerow(
                        [
                            "roadmap",
                            roadmap.participant_name,
                            roadmap.revision_index,
                            roadmap.current_role,
                            roadmap.target_role,
                            roadmap.time_horizon_weeks,
                            milestone.get("phase_title", ""),
                            milestone.get("timeframe", ""),
                            milestone.get("objective", ""),
                            milestone.get("success_indicator", ""),
                        ]
                    )

        return buf.getvalue()

    async def get_revision_notes(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID,
    ) -> list[RevisionNoteResponse]:
        syllabus = await self._get_owned_syllabus(syllabus_id, owner_id=owner_id)
        history_rows = await self.get_history_for_syllabus(syllabus_id, owner_id=str(owner_id))
        personalization_rows = await self._get_personalizations(syllabus_id)
        message_rows = await self._get_chat_messages(syllabus_id)

        current_revision_index = len(syllabus.revision_history or [])
        snapshots = self._build_revision_snapshots(syllabus)
        revised_events = {
            row.revision_index: row
            for row in history_rows
            if row.action == "revised" and row.revision_index is not None
        }
        finalized_event = next((row for row in history_rows if row.action == "finalized"), None)
        messages_by_id = {message.id: message for message in message_rows}

        notes: list[RevisionNoteResponse] = []
        for revision_index, current_snapshot in enumerate(snapshots):
            if revision_index == 0:
                event = finalized_event
                source_kind = "finalized"
                summary = event.summary if event else f"Finalized syllabus for {syllabus.topic}"
                reason = ""
                source_message_id = None
                applied_fields: list[str] = []
                created_at = event.created_at if event else syllabus.created_at
            else:
                event = revised_events.get(revision_index)
                source_kind = "revised"
                previous_entry = syllabus.revision_history[revision_index - 1]
                summary = str(previous_entry.get("summary", "")).strip() or (
                    event.summary if event else f"Revision {revision_index}"
                )
                reason = (
                    str(previous_entry.get("reason", "")).strip()
                    or str((event.detail or {}).get("reason", "")).strip()
                )
                source_message_id = self._maybe_uuid(previous_entry.get("source_message_id"))
                applied_fields = [
                    str(item)
                    for item in previous_entry.get("applied_fields", [])
                    if isinstance(item, str)
                ]
                created_at = (
                    event.created_at
                    if event
                    else self._snapshot_revised_at(previous_entry, syllabus.updated_at)
                )

            downstream = self._build_downstream_summary(
                revision_index=revision_index,
                history_rows=history_rows,
                personalization_rows=personalization_rows,
            )
            message = (
                messages_by_id.get(source_message_id) if source_message_id is not None else None
            )
            notes.append(
                RevisionNoteResponse(
                    revision_index=revision_index,
                    is_current=revision_index == current_revision_index,
                    source_kind=source_kind,
                    summary=summary,
                    reason=reason,
                    source_message_id=source_message_id,
                    source_message_excerpt=self._message_excerpt(message.content)
                    if message
                    else None,
                    applied_fields=applied_fields,
                    created_at=created_at,
                    previous_snapshot=snapshots[revision_index - 1] if revision_index > 0 else None,
                    current_snapshot=current_snapshot,
                    downstream=downstream,
                )
            )

        return notes

    async def _get_owned_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(
            GeneratedSyllabus.id == syllabus_id,
            GeneratedSyllabus.owner_id == owner_id,
        )
        result = await self.db.execute(stmt)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return syllabus

    async def _get_personalizations(self, syllabus_id: uuid.UUID) -> list[PersonalizationResult]:
        result = await self.db.execute(
            select(PersonalizationResult)
            .where(PersonalizationResult.syllabus_id == syllabus_id)
            .order_by(PersonalizationResult.created_at.asc())
        )
        return list(result.scalars().all())

    async def _get_chat_messages(self, syllabus_id: uuid.UUID) -> list[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.syllabus_id == syllabus_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    def _build_revision_snapshots(self, syllabus: GeneratedSyllabus) -> list[RevisionSnapshot]:
        history_entries = list(syllabus.revision_history or [])
        snapshots: list[RevisionSnapshot] = []

        if history_entries:
            for index, entry in enumerate(history_entries):
                snapshots.append(self._snapshot_from_payload(index, entry))

        snapshots.append(
            RevisionSnapshot(
                revision_index=len(history_entries),
                tlo=syllabus.tlo,
                performance_result=syllabus.performance_result or "",
                condition_result=syllabus.condition_result or "",
                standard_result=syllabus.standard_result or "",
                elos=[
                    str(item.get("elo", "")).strip()
                    for item in syllabus.elos or []
                    if isinstance(item, dict) and str(item.get("elo", "")).strip()
                ],
                journey_summary=self._journey_summary(syllabus.journey or {}),
            )
        )
        return snapshots

    def _snapshot_from_payload(
        self, revision_index: int, payload: dict[str, object]
    ) -> RevisionSnapshot:
        raw_elos = payload.get("elos", [])
        elo_items = raw_elos if isinstance(raw_elos, list) else []
        return RevisionSnapshot(
            revision_index=revision_index,
            tlo=str(payload.get("tlo", "")).strip(),
            performance_result=str(payload.get("performance_result", "")).strip(),
            condition_result=str(payload.get("condition_result", "")).strip(),
            standard_result=str(payload.get("standard_result", "")).strip(),
            elos=[
                str(item.get("elo", "")).strip()
                for item in elo_items
                if isinstance(item, dict) and str(item.get("elo", "")).strip()
            ],
            journey_summary=self._journey_summary(payload.get("journey", {})),
        )

    def _journey_summary(self, raw: object) -> dict[str, list[str]]:
        if not isinstance(raw, dict):
            return {"pre_learning": [], "classroom": [], "after_learning": []}
        summary: dict[str, list[str]] = {}
        for stage_key in ("pre_learning", "classroom", "after_learning"):
            stage = raw.get(stage_key)
            if not isinstance(stage, dict):
                summary[stage_key] = []
                continue
            items: list[str] = []
            duration = str(stage.get("duration", "")).strip()
            raw_method = stage.get("method", [])
            method = (
                [
                    str(item).strip()
                    for item in raw_method
                    if isinstance(item, str) and str(item).strip()
                ]
                if isinstance(raw_method, list)
                else ([str(raw_method).strip()] if str(raw_method).strip() else [])
            )
            description = str(stage.get("description", "")).strip()
            raw_content = stage.get("content", [])
            content = raw_content if isinstance(raw_content, list) else []
            if duration:
                items.append(f"Duration: {duration}")
            if method:
                items.append("Method:")
                items.extend(method)
            if description:
                items.append(f"Description: {description}")
            items.extend(
                str(item).strip() for item in content if isinstance(item, str) and str(item).strip()
            )
            summary[stage_key] = items
        return summary

    def _build_downstream_summary(
        self,
        *,
        revision_index: int,
        history_rows: list[OwnerHistory],
        personalization_rows: list[PersonalizationResult],
    ) -> RevisionDownstreamSummary:
        relevant_personalizations = [
            row
            for row in personalization_rows
            if getattr(row, "revision_index", 0) == revision_index
        ]
        export_events = [
            row
            for row in history_rows
            if row.action == "exported" and row.revision_index == revision_index
        ]
        module_events = [
            row
            for row in history_rows
            if row.action == "decomposed" and row.revision_index == revision_index
        ]
        return RevisionDownstreamSummary(
            personalization_count=len(relevant_personalizations),
            participant_names=[
                row.participant_name for row in relevant_personalizations if row.participant_name
            ],
            export_count=len(export_events),
            module_generation_count=len(module_events),
            latest_personalized_at=relevant_personalizations[-1].created_at
            if relevant_personalizations
            else None,
            latest_exported_at=export_events[-1].created_at if export_events else None,
            latest_decomposed_at=module_events[-1].created_at if module_events else None,
        )

    def _snapshot_revised_at(self, payload: dict[str, object], fallback: datetime) -> datetime:
        raw = payload.get("revised_at")
        if isinstance(raw, str):
            try:
                return datetime.fromisoformat(raw)
            except ValueError:
                return fallback
        return fallback

    def _maybe_uuid(self, value: object) -> uuid.UUID | None:
        if not value:
            return None
        try:
            return uuid.UUID(str(value))
        except (TypeError, ValueError):
            return None

    def _message_excerpt(self, content: str) -> str:
        normalized = " ".join(content.split())
        return normalized[:180] + ("..." if len(normalized) > 180 else "")


class DecompositionService:
    """Post-finalize module decomposition derived from GeneratedSyllabus."""

    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def decompose(
        self,
        syllabus_id: uuid.UUID,
        *,
        module_count_hint: int | None = None,
        owner_id: uuid.UUID | None = None,
    ) -> list[ModuleDecomposition]:
        """Derive module decomposition from a finalized syllabus.

        This is a deterministic heuristic decomposition (no AI call)
        that splits the syllabus journey stages + ELOs into modules.
        """
        syllabus = await self._get_finalized_syllabus(syllabus_id, owner_id=owner_id)

        # Clear existing decomposition first
        await self.clear_decompositions(syllabus_id)

        modules = self._build_modules(syllabus, module_count_hint)

        for mod in modules:
            self.db.add(mod)
        await self.db.flush()
        for mod in modules:
            await self.db.refresh(mod)

        history_entry = OwnerHistory(
            syllabus_id=syllabus_id,
            owner_id=str(owner_id) if owner_id is not None else "default",
            action="decomposed",
            summary=f"Generated {len(modules)} module decomposition(s)",
            detail={"module_count": len(modules)},
            revision_index=len(syllabus.revision_history or []),
        )
        self.db.add(history_entry)
        return modules

    async def get_decompositions(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> list[ModuleDecomposition]:
        await self._get_finalized_syllabus(syllabus_id, owner_id=owner_id)
        result = await self.db.execute(
            select(ModuleDecomposition)
            .where(ModuleDecomposition.syllabus_id == syllabus_id)
            .order_by(ModuleDecomposition.module_index.asc())
        )
        return list(result.scalars().all())

    async def clear_decompositions(self, syllabus_id: uuid.UUID) -> int:
        """Delete all derived modules for a syllabus. Returns count deleted."""
        result = await self.db.execute(
            delete(ModuleDecomposition).where(ModuleDecomposition.syllabus_id == syllabus_id)
        )
        return result.rowcount  # type: ignore[return-value]

    # ----- private ---------------------------------------------------------

    async def _get_finalized_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(GeneratedSyllabus.id == syllabus_id)
        if owner_id is not None:
            stmt = stmt.where(GeneratedSyllabus.owner_id == owner_id)
        result = await self.db.execute(stmt)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        if syllabus.status != "finalized":
            raise ValidationException("Module decomposition requires a finalized syllabus")
        return syllabus

    async def _get_owned_syllabus(
        self,
        syllabus_id: uuid.UUID,
        *,
        owner_id: uuid.UUID,
    ) -> GeneratedSyllabus:
        stmt = select(GeneratedSyllabus).where(
            GeneratedSyllabus.id == syllabus_id,
            GeneratedSyllabus.owner_id == owner_id,
        )
        result = await self.db.execute(stmt)
        syllabus = result.scalar_one_or_none()
        if syllabus is None:
            raise NotFoundException("Syllabus", str(syllabus_id))
        return syllabus

    async def _get_personalizations(self, syllabus_id: uuid.UUID) -> list[PersonalizationResult]:
        result = await self.db.execute(
            select(PersonalizationResult)
            .where(PersonalizationResult.syllabus_id == syllabus_id)
            .order_by(PersonalizationResult.created_at.asc())
        )
        return list(result.scalars().all())

    async def _get_chat_messages(self, syllabus_id: uuid.UUID) -> list[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.syllabus_id == syllabus_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    def _build_revision_snapshots(self, syllabus: GeneratedSyllabus) -> list[RevisionSnapshot]:
        history_entries = list(syllabus.revision_history or [])
        snapshots: list[RevisionSnapshot] = []

        if history_entries:
            for index, entry in enumerate(history_entries):
                snapshots.append(self._snapshot_from_payload(index, entry))

        snapshots.append(
            RevisionSnapshot(
                revision_index=len(history_entries),
                tlo=syllabus.tlo,
                performance_result=syllabus.performance_result or "",
                condition_result=syllabus.condition_result or "",
                standard_result=syllabus.standard_result or "",
                elos=[
                    str(item.get("elo", "")).strip()
                    for item in syllabus.elos or []
                    if isinstance(item, dict) and str(item.get("elo", "")).strip()
                ],
                journey_summary=self._journey_summary(syllabus.journey or {}),
            )
        )
        return snapshots

    def _snapshot_from_payload(
        self, revision_index: int, payload: dict[str, object]
    ) -> RevisionSnapshot:
        return RevisionSnapshot(
            revision_index=revision_index,
            tlo=str(payload.get("tlo", "")).strip(),
            performance_result=str(payload.get("performance_result", "")).strip(),
            condition_result=str(payload.get("condition_result", "")).strip(),
            standard_result=str(payload.get("standard_result", "")).strip(),
            elos=[
                str(item.get("elo", "")).strip()
                for item in payload.get("elos", [])
                if isinstance(item, dict) and str(item.get("elo", "")).strip()
            ],
            journey_summary=self._journey_summary(payload.get("journey", {})),
        )

    def _journey_summary(self, raw: object) -> dict[str, list[str]]:
        if not isinstance(raw, dict):
            return {"pre_learning": [], "classroom": [], "after_learning": []}
        summary: dict[str, list[str]] = {}
        for stage_key in ("pre_learning", "classroom", "after_learning"):
            stage = raw.get(stage_key)
            if not isinstance(stage, dict):
                summary[stage_key] = []
                continue
            items: list[str] = []
            duration = str(stage.get("duration", "")).strip()
            method = str(stage.get("method", "")).strip()
            description = str(stage.get("description", "")).strip()
            content = stage.get("content", [])
            if duration:
                items.append(f"Duration: {duration}")
            if method:
                items.append(f"Method: {method}")
            if description:
                items.append(f"Description: {description}")
            if isinstance(content, list):
                items.extend(
                    str(item).strip()
                    for item in content
                    if isinstance(item, str) and str(item).strip()
                )
            summary[stage_key] = items
        return summary

    def _build_downstream_summary(
        self,
        *,
        revision_index: int,
        history_rows: list[OwnerHistory],
        personalization_rows: list[PersonalizationResult],
    ) -> RevisionDownstreamSummary:
        relevant_personalizations = [
            row
            for row in personalization_rows
            if getattr(row, "revision_index", 0) == revision_index
        ]
        export_events = [
            row
            for row in history_rows
            if row.action == "exported" and row.revision_index == revision_index
        ]
        module_events = [
            row
            for row in history_rows
            if row.action == "decomposed" and row.revision_index == revision_index
        ]
        return RevisionDownstreamSummary(
            personalization_count=len(relevant_personalizations),
            participant_names=[
                row.participant_name for row in relevant_personalizations if row.participant_name
            ],
            export_count=len(export_events),
            module_generation_count=len(module_events),
            latest_personalized_at=(
                relevant_personalizations[-1].created_at if relevant_personalizations else None
            ),
            latest_exported_at=(export_events[-1].created_at if export_events else None),
            latest_decomposed_at=(module_events[-1].created_at if module_events else None),
        )

    def _snapshot_revised_at(self, payload: dict[str, object], fallback: datetime) -> datetime:
        raw = payload.get("revised_at")
        if isinstance(raw, str):
            try:
                return datetime.fromisoformat(raw)
            except ValueError:
                return fallback
        return fallback

    def _maybe_uuid(self, value: object) -> uuid.UUID | None:
        if not value:
            return None
        try:
            return uuid.UUID(str(value))
        except (TypeError, ValueError):
            return None

    def _message_excerpt(self, content: str) -> str:
        normalized = " ".join(content.split())
        return normalized[:180] + ("..." if len(normalized) > 180 else "")

    def _build_modules(
        self,
        syllabus: GeneratedSyllabus,
        module_count_hint: int | None,
    ) -> list[ModuleDecomposition]:
        """Deterministic heuristic: one module per journey stage, with
        ELOs distributed round-robin across modules.
        """
        journey: dict[str, Any] = syllabus.journey or {}
        stages = [
            ("pre_learning", "Pra-Pembelajaran"),
            ("classroom", "Pembelajaran Kelas"),
            ("after_learning", "Pasca-Pembelajaran"),
        ]

        elos: list[dict[str, Any]] = syllabus.elos or []
        desired_count = module_count_hint or len(stages)
        # Never exceed 3 when using stage-based split (unless hint asks more)
        if module_count_hint is None:
            desired_count = len(stages)

        modules: list[ModuleDecomposition] = []

        if desired_count <= len(stages):
            # One module per stage
            elo_dist = self._distribute_round_robin(elos, desired_count)
            for idx, (stage_key, stage_label) in enumerate(stages[:desired_count]):
                stage_data = journey.get(stage_key, {})
                if not isinstance(stage_data, dict):
                    stage_data = {}
                modules.append(
                    self._stage_to_module(
                        syllabus_id=syllabus.id,
                        module_index=idx,
                        stage_label=stage_label,
                        stage_data=stage_data,
                        assigned_elos=elo_dist[idx],
                    )
                )
        else:
            # More modules than stages: split classroom stage further
            elo_dist = self._distribute_round_robin(elos, desired_count)
            classroom_data = journey.get("classroom", {})
            if not isinstance(classroom_data, dict):
                classroom_data = {}
            classroom_content: list[str] = classroom_data.get("content", [])
            if not isinstance(classroom_content, list):
                classroom_content = []

            extra_count = desired_count - len(stages)
            # Module 0: pre_learning
            pre_data = journey.get("pre_learning", {})
            if not isinstance(pre_data, dict):
                pre_data = {}
            modules.append(
                self._stage_to_module(
                    syllabus_id=syllabus.id,
                    module_index=0,
                    stage_label="Pra-Pembelajaran",
                    stage_data=pre_data,
                    assigned_elos=elo_dist[0],
                )
            )
            # Modules 1..1+extra: classroom splits
            chunks = self._split_list(classroom_content, extra_count + 1)
            for ci in range(extra_count + 1):
                chunk = chunks[ci] if ci < len(chunks) else []
                sub_stage = {
                    "duration": classroom_data.get("duration", ""),
                    "description": classroom_data.get("description", ""),
                    "content": chunk,
                }
                modules.append(
                    self._stage_to_module(
                        syllabus_id=syllabus.id,
                        module_index=1 + ci,
                        stage_label=f"Pembelajaran Kelas ({ci + 1})",
                        stage_data=sub_stage,
                        assigned_elos=elo_dist[1 + ci],
                    )
                )
            # Last module: after_learning
            after_data = journey.get("after_learning", {})
            if not isinstance(after_data, dict):
                after_data = {}
            modules.append(
                self._stage_to_module(
                    syllabus_id=syllabus.id,
                    module_index=desired_count - 1,
                    stage_label="Pasca-Pembelajaran",
                    stage_data=after_data,
                    assigned_elos=elo_dist[desired_count - 1],
                )
            )

        return modules

    def _stage_to_module(
        self,
        *,
        syllabus_id: uuid.UUID,
        module_index: int,
        stage_label: str,
        stage_data: dict[str, Any],
        assigned_elos: list[dict[str, Any]],
    ) -> ModuleDecomposition:
        content: list[str] = stage_data.get("content", [])
        if not isinstance(content, list):
            content = []

        duration_str: str = str(stage_data.get("duration", ""))
        duration_minutes = self._parse_duration_minutes(duration_str)

        return ModuleDecomposition(
            syllabus_id=syllabus_id,
            module_index=module_index,
            title=f"Modul {module_index + 1}: {stage_label}",
            description=str(stage_data.get("description", "")),
            learning_objectives=[str(e.get("elo", "")) for e in assigned_elos],
            topics=content,
            duration_minutes=duration_minutes,
            activities=[
                {"type": "guided", "description": item, "duration_minutes": 0} for item in content
            ],
            assessment={
                "method": "observation",
                "criteria": [str(e.get("elo", "")) for e in assigned_elos],
            },
        )

    @staticmethod
    def _distribute_round_robin(
        items: list[dict[str, Any]], bucket_count: int
    ) -> list[list[dict[str, Any]]]:
        buckets: list[list[dict[str, Any]]] = [[] for _ in range(max(bucket_count, 1))]
        for idx, item in enumerate(items):
            buckets[idx % len(buckets)].append(item)
        return buckets

    @staticmethod
    def _split_list(lst: list[str], n: int) -> list[list[str]]:
        if n <= 0:
            return [lst]
        k, m = divmod(len(lst), n)
        return [lst[i * k + min(i, m) : (i + 1) * k + min(i + 1, m)] for i in range(n)]

    @staticmethod
    def _parse_duration_minutes(text: str) -> int:
        """Best-effort parse of Indonesian-style duration strings."""
        text = text.lower().strip()
        if not text:
            return 0
        # "60 menit" / "240 menit"
        for token in text.split():
            if token.isdigit():
                num = int(token)
                if "jam" in text:
                    return num * 60
                if "hari" in text:
                    return num * 480  # 8-hour day
                if "minggu" in text:
                    return num * 2400  # 5-day week
                return num  # default: minutes
        return 0
