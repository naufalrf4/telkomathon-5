"""initial_schema_clean

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-05 00:00:00.000000

Single canonical migration reflecting the live PRIMA model set:
  users, documents, document_chunks, design_sessions,
  generated_syllabi, personalization_results
"""

from collections.abc import Sequence

import pgvector.sqlalchemy.vector
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=150), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # documents
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("doc_type", sa.String(length=50), nullable=False),
        sa.Column("file_format", sa.String(length=10), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("upload_date", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # document_chunks
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.vector.VECTOR(dim=3072), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # generated_syllabi
    op.create_table(
        "generated_syllabi",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("target_level", sa.Integer(), nullable=False),
        sa.Column("course_category", sa.String(length=255), nullable=True),
        sa.Column("client_company_name", sa.String(length=255), nullable=True),
        sa.Column("course_title", sa.String(length=255), nullable=True),
        sa.Column("company_profile_summary", sa.Text(), nullable=True),
        sa.Column("commercial_overview", sa.Text(), nullable=True),
        sa.Column("tlo", sa.Text(), nullable=False),
        sa.Column("performance_result", sa.Text(), nullable=True),
        sa.Column("condition_result", sa.Text(), nullable=True),
        sa.Column("standard_result", sa.Text(), nullable=True),
        sa.Column("elos", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("journey", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source_doc_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("revision_history", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("target_level BETWEEN 1 AND 5", name="ck_target_level"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # design_sessions
    op.create_table(
        "design_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("document_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("wizard_step", sa.String(length=50), nullable=False),
        sa.Column("source_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("course_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("tlo_options", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("selected_tlo", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("performance_options", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("selected_performance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("elo_options", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("selected_elos", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("finalized_syllabus_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # personalization_results
    op.create_table(
        "personalization_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("syllabus_id", sa.Uuid(), nullable=False),
        sa.Column("bulk_session_id", sa.Uuid(), nullable=True),
        sa.Column("participant_name", sa.String(), nullable=False),
        sa.Column("revision_index", sa.Integer(), nullable=False),
        sa.Column("competency_gaps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("recommendations", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["syllabus_id"], ["generated_syllabi.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("personalization_results")
    op.drop_table("design_sessions")
    op.drop_table("generated_syllabi")
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
