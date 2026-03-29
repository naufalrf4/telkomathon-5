import uuid
from datetime import datetime
from typing import ClassVar

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DesignSession(Base):
    __tablename__ = "design_sessions"

    preview_condition_result: ClassVar[str | None] = None
    preview_standard_result: ClassVar[str | None] = None

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    wizard_step: Mapped[str] = mapped_column(String(50), default="uploaded")
    source_summary: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    course_context: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    tlo_options: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    selected_tlo: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    performance_options: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    selected_performance: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    elo_options: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    selected_elos: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    finalized_syllabus_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
