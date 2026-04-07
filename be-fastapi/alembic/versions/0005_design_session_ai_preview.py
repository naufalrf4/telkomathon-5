"""add ai_preview_sections to design_sessions

Revision ID: 0005_design_session_ai_preview
Revises: 0004_syllabus_gen_meta
Create Date: 2026-04-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005_design_session_ai_preview"
down_revision: str | None = "0004_syllabus_gen_meta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "design_sessions",
        sa.Column(
            "ai_preview_sections",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("design_sessions", "ai_preview_sections")
