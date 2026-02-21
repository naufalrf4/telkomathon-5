import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GeneratedSyllabus(Base):
    __tablename__ = "generated_syllabi"

    __table_args__ = (
        CheckConstraint("target_level BETWEEN 1 AND 5", name="ck_target_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(255))
    target_level: Mapped[int] = mapped_column(Integer)
    tlo: Mapped[str] = mapped_column(Text)
    elos: Mapped[dict] = mapped_column(JSONB)
    journey: Mapped[dict] = mapped_column(JSONB)
    source_doc_ids: Mapped[list] = mapped_column(JSONB, default=list)
    revision_history: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )
