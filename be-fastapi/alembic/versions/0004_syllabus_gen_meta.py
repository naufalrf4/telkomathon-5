"""add generation_meta to generated_syllabi

Revision ID: 0004_syllabus_gen_meta
Revises: 0003_rev_msg_sections
Create Date: 2026-04-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_syllabus_gen_meta"
down_revision: str | None = "0003_rev_msg_sections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "generated_syllabi",
        sa.Column(
            "generation_meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("generated_syllabi", "generation_meta")
