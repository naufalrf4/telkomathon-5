"""add_users_table_and_owner_id_columns

Revision ID: f1a2b3c4d5e6
Revises: d4a7e8f91b2c
Create Date: 2026-03-29 15:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "d4a7e8f91b2c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=150), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Add nullable owner_id FK to core tables (existing rows get NULL)
    op.add_column(
        "design_sessions",
        sa.Column("owner_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_design_sessions_owner_id",
        "design_sessions",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "generated_syllabi",
        sa.Column("owner_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_generated_syllabi_owner_id",
        "generated_syllabi",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "documents",
        sa.Column("owner_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_documents_owner_id",
        "documents",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_documents_owner_id", "documents", type_="foreignkey")
    op.drop_column("documents", "owner_id")

    op.drop_constraint("fk_generated_syllabi_owner_id", "generated_syllabi", type_="foreignkey")
    op.drop_column("generated_syllabi", "owner_id")

    op.drop_constraint("fk_design_sessions_owner_id", "design_sessions", type_="foreignkey")
    op.drop_column("design_sessions", "owner_id")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
