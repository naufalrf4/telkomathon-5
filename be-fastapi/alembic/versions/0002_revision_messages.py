"""add revision_messages table

Revision ID: 0002_revision_messages
Revises: 0001_initial
Create Date: 2026-04-07 00:00:00.000000

Adds the revision_messages table for chat-based syllabus revision.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_revision_messages"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "revision_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("syllabus_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "target_sections",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "proposed_changes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["syllabus_id"],
            ["generated_syllabi.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_revision_messages_syllabus_id",
        "revision_messages",
        ["syllabus_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_revision_messages_syllabus_id", table_name="revision_messages")
    op.drop_table("revision_messages")
