from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: str | Sequence[str] | None = "b8c9d0e1f2a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "personalization_results",
        sa.Column("bulk_session_id", sa.UUID(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("personalization_results", "bulk_session_id")
