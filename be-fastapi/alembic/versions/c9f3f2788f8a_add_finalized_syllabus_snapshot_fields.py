"""add_finalized_syllabus_snapshot_fields

Revision ID: c9f3f2788f8a
Revises: 8f1629c83c67
Create Date: 2026-03-15 21:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c9f3f2788f8a"
down_revision: str | Sequence[str] | None = "8f1629c83c67"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "generated_syllabi",
        sa.Column("course_category", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("client_company_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("course_title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("company_profile_summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("commercial_overview", sa.Text(), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("performance_result", sa.Text(), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("condition_result", sa.Text(), nullable=True),
    )
    op.add_column(
        "generated_syllabi",
        sa.Column("standard_result", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("generated_syllabi", "standard_result")
    op.drop_column("generated_syllabi", "condition_result")
    op.drop_column("generated_syllabi", "performance_result")
    op.drop_column("generated_syllabi", "commercial_overview")
    op.drop_column("generated_syllabi", "company_profile_summary")
    op.drop_column("generated_syllabi", "course_title")
    op.drop_column("generated_syllabi", "client_company_name")
    op.drop_column("generated_syllabi", "course_category")
