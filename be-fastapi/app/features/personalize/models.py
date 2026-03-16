import uuid
from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PersonalizationResult(Base):
    __tablename__ = "personalization_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    syllabus_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
    )
    competency_gaps: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    recommendations: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
