"""add_design_sessions_table

Revision ID: 8d2c7f6b1a1f
Revises: e48cdb1a522e
Create Date: 2026-03-09 09:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8d2c7f6b1a1f"
down_revision: str | None = "e48cdb1a522e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "design_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "document_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "wizard_step",
            sa.String(length=50),
            nullable=False,
            server_default="uploaded",
        ),
        sa.Column("source_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("course_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "tlo_options",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("selected_tlo", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "performance_options",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("selected_performance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "elo_options",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "selected_elos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("finalized_syllabus_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finalized_syllabus_id"],
            ["generated_syllabi.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("design_sessions")
