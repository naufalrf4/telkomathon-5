"""add_owner_history_and_module_decompositions

Revision ID: d4a7e8f91b2c
Revises: c9f3f2788f8a
Create Date: 2026-03-29 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d4a7e8f91b2c"
down_revision: str | Sequence[str] | None = "c9f3f2788f8a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "owner_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "syllabus_id",
            sa.Uuid(),
            sa.ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.String(length=255), nullable=False, server_default="default"),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("detail", sa.dialects.postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("revision_index", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_owner_history_syllabus_id", "owner_history", ["syllabus_id"])
    op.create_index("ix_owner_history_owner_id", "owner_history", ["owner_id"])

    op.create_table(
        "module_decompositions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "syllabus_id",
            sa.Uuid(),
            sa.ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("module_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "learning_objectives",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("topics", sa.dialects.postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "activities", sa.dialects.postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column(
            "assessment", sa.dialects.postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_module_decompositions_syllabus_id", "module_decompositions", ["syllabus_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_module_decompositions_syllabus_id", table_name="module_decompositions")
    op.drop_table("module_decompositions")
    op.drop_index("ix_owner_history_owner_id", table_name="owner_history")
    op.drop_index("ix_owner_history_syllabus_id", table_name="owner_history")
    op.drop_table("owner_history")
