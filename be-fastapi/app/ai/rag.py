import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import generate_embedding
from app.config import settings

SIMILARITY_THRESHOLD = settings.SIMILARITY_THRESHOLD


async def retrieve_relevant_chunks(
    query: str,
    doc_ids: list[uuid.UUID],
    db: AsyncSession,
    top_k: int = 10,
) -> list[dict[str, Any]]:
    query_embedding = await generate_embedding(query)
    doc_id_strings = [str(d) for d in doc_ids]

    vector_results = await _vector_search(query_embedding, doc_id_strings, db, limit=20)
    fts_results = await _fulltext_search(query, doc_id_strings, db, limit=20)

    fused = _reciprocal_rank_fusion([vector_results, fts_results], top_n=top_k)
    return [r for r in fused if r["score"] >= SIMILARITY_THRESHOLD]


async def _vector_search(
    embedding: list[float],
    doc_id_strings: list[str],
    db: AsyncSession,
    limit: int = 20,
) -> list[dict[str, Any]]:
    embedding_str = f"[{','.join(str(x) for x in embedding)}]"
    stmt = text("""
        SELECT id, chunk_text, metadata, document_id,
               1 - (embedding <=> :embedding::vector) AS score
        FROM document_chunks
        WHERE document_id = ANY(:doc_ids::uuid[])
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)
    result = await db.execute(
        stmt,
        {"embedding": embedding_str, "doc_ids": doc_id_strings, "limit": limit},
    )
    rows = result.fetchall()
    return [
        {
            "id": str(r.id),
            "text": r.chunk_text,
            "metadata": r.metadata,
            "score": float(r.score),
        }
        for r in rows
    ]


async def _fulltext_search(
    query: str,
    doc_id_strings: list[str],
    db: AsyncSession,
    limit: int = 20,
) -> list[dict[str, Any]]:
    stmt = text("""
        SELECT id, chunk_text, metadata, document_id,
               ts_rank(to_tsvector('indonesian', chunk_text), plainto_tsquery('indonesian', :query)) AS score
        FROM document_chunks
        WHERE document_id = ANY(:doc_ids::uuid[])
          AND to_tsvector('indonesian', chunk_text) @@ plainto_tsquery('indonesian', :query)
        ORDER BY score DESC
        LIMIT :limit
    """)
    result = await db.execute(
        stmt, {"query": query, "doc_ids": doc_id_strings, "limit": limit}
    )
    rows = result.fetchall()
    return [
        {
            "id": str(r.id),
            "text": r.chunk_text,
            "metadata": r.metadata,
            "score": float(r.score),
        }
        for r in rows
    ]


def _reciprocal_rank_fusion(
    result_lists: list[list[dict[str, Any]]],
    top_n: int = 10,
    k: int = 60,
) -> list[dict[str, Any]]:
    scores: dict[str, float] = {}
    items: dict[str, dict[str, Any]] = {}

    for result_list in result_lists:
        for rank, item in enumerate(result_list):
            item_id = item["id"]
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k + rank + 1)
            items[item_id] = item

    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    fused = []
    for item_id in sorted_ids[:top_n]:
        item = items[item_id].copy()
        item["score"] = scores[item_id]
        fused.append(item)
    return fused


def build_context_block(chunks: list[dict[str, Any]]) -> str:
    sections = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        section = meta.get("section", "Content")
        page = meta.get("page_number", "?")
        label = f"[{section} — Page {page}]"
        sections.append(f"{label}\n{chunk['text']}")
    return "\n\n".join(sections)
