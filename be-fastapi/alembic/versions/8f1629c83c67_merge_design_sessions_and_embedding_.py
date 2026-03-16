"""merge_design_sessions_and_embedding_heads

Revision ID: 8f1629c83c67
Revises: 8d2c7f6b1a1f, a1b2c3d4e5f6
Create Date: 2026-03-09 12:09:01.929633

"""

from collections.abc import Sequence


revision: str = "8f1629c83c67"
down_revision: str | Sequence[str] | None = ("8d2c7f6b1a1f", "a1b2c3d4e5f6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
