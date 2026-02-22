from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e48cdb1a522e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM document_chunks")
    op.drop_column("document_chunks", "embedding")
    op.add_column(
        "document_chunks",
        sa.Column("embedding", Vector(3072), nullable=False),
    )


def downgrade() -> None:
    op.execute("DELETE FROM document_chunks")
    op.drop_column("document_chunks", "embedding")
    op.add_column(
        "document_chunks",
        sa.Column("embedding", Vector(1536), nullable=False),
    )
