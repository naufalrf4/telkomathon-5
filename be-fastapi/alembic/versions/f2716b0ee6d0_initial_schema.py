"""initial_schema

Revision ID: f2716b0ee6d0
Revises:
Create Date: 2026-02-21 14:24:35.767317

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f2716b0ee6d0"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(100), nullable=True),
        sa.Column("file_format", sa.String(20), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "upload_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "document_id",
            sa.UUID(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_document_chunks_document_id", "document_chunks", ["document_id"]
    )

    op.execute(
        "ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1536) "
        "USING CASE WHEN embedding IS NULL THEN NULL ELSE embedding::vector(1536) END"
    )

    op.execute(
        "CREATE INDEX document_chunks_embedding_idx ON document_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.create_table(
        "generated_syllabi",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("topic", sa.String(500), nullable=False),
        sa.Column("target_level", sa.Integer(), nullable=False),
        sa.Column("tlo", sa.Text(), nullable=False),
        sa.Column("elos_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("journey_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("doc_ids_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_level >= 1 AND target_level <= 5", name="ck_syllabi_target_level"
        ),
    )

    op.create_table(
        "personalization_results",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "syllabus_id",
            sa.UUID(),
            sa.ForeignKey("generated_syllabi.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "learner_profile_json", sa.JSON(), nullable=False, server_default="{}"
        ),
        sa.Column("gap_analysis_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "recommendations_json", sa.JSON(), nullable=False, server_default="[]"
        ),
        sa.Column("micro_modules_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "syllabus_id",
            sa.UUID(),
            sa.ForeignKey("generated_syllabi.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_chat_messages_syllabus_id", "chat_messages", ["syllabus_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_syllabus_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("personalization_results")
    op.drop_table("generated_syllabi")
    op.execute("DROP INDEX IF EXISTS document_chunks_embedding_idx")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_table("documents")
