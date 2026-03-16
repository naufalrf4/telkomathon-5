import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GeneratedSyllabus(Base):
    __tablename__ = "generated_syllabi"

    __table_args__ = (CheckConstraint("target_level BETWEEN 1 AND 5", name="ck_target_level"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(255))
    target_level: Mapped[int] = mapped_column(Integer)
    course_category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    course_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_profile_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    commercial_overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    tlo: Mapped[str] = mapped_column(Text)
    performance_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    standard_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    elos: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    journey: Mapped[dict[str, list[str]]] = mapped_column(JSONB)
    source_doc_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    revision_history: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
