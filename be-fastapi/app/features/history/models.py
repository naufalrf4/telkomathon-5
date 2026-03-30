import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OwnerHistory(Base):
    """Persisted owner-scoped action history tied to a syllabus.

    Each row records a discrete event (create, revise, finalize, decompose,
    personalize, export, etc.) so that aggregation queries and CSV export
    can be driven from the database rather than reconstructed at runtime.
    """

    __tablename__ = "owner_history"

    __table_args__ = (
        Index("ix_owner_history_syllabus_id", "syllabus_id"),
        Index("ix_owner_history_owner_id", "owner_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    syllabus_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
    )
    owner_id: Mapped[str] = mapped_column(
        String(255),
        default="default",
        doc="Placeholder for future auth; currently 'default'.",
    )
    action: Mapped[str] = mapped_column(
        String(50),
        doc="Event kind: created | revised | finalized | decomposed | personalized | exported",
    )
    summary: Mapped[str] = mapped_column(Text, default="")
    detail: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    revision_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ModuleDecomposition(Base):
    """Post-finalize module breakdown derived from a GeneratedSyllabus.

    Modules are generated *after* finalization and are considered derived
    artefacts; they MUST be cleared when the source syllabus is mutated
    via revision-apply so they never go stale.
    """

    __tablename__ = "module_decompositions"

    __table_args__ = (Index("ix_module_decompositions_syllabus_id", "syllabus_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    syllabus_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
    )
    module_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    learning_objectives: Mapped[list[str]] = mapped_column(JSONB, default=list)
    topics: Mapped[list[str]] = mapped_column(JSONB, default=list)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    activities: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    assessment: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
