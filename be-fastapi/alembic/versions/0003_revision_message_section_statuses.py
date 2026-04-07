"""add section_statuses to revision_messages

Revision ID: 0003_rev_msg_sections
Revises: 0002_revision_messages
Create Date: 2026-04-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_rev_msg_sections"
down_revision: str | None = "0002_revision_messages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "revision_messages",
        sa.Column(
            "section_statuses",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("revision_messages", "section_statuses")
