"""add career roadmap results

Revision ID: e2f3a4b5c6d7
Revises: c1d2e3f4a5b6
Create Date: 2026-03-30 11:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2f3a4b5c6d7"
down_revision: str | Sequence[str] | None = "c1d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "career_roadmap_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("syllabus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("current_role", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("target_role", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("time_horizon_weeks", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("revision_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("competency_gaps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("milestones", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.ForeignKeyConstraint(["syllabus_id"], ["generated_syllabi.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("career_roadmap_results")
