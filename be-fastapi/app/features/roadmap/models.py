import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CareerRoadmapResult(Base):
    __tablename__ = "career_roadmap_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    syllabus_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
    )
    participant_name: Mapped[str] = mapped_column(String(255), default="")
    current_role: Mapped[str] = mapped_column(String(255), default="")
    target_role: Mapped[str] = mapped_column(String(255), default="")
    time_horizon_weeks: Mapped[int] = mapped_column(Integer, default=12)
    revision_index: Mapped[int] = mapped_column(Integer, default=0)
    competency_gaps: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    milestones: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
