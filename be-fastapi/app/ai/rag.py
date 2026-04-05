import logging
import uuid
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.constants import RETRIEVAL_SCORE_THRESHOLD
from app.ai.embeddings import generate_embedding

logger = logging.getLogger(__name__)


async def retrieve_relevant_chunks(
    query: str,
    doc_ids: list[uuid.UUID],
    db: AsyncSession,
    top_k: int = 10,
) -> list[dict[str, Any]]:
    doc_id_strings = [str(d) for d in doc_ids]
    try:
        query_embedding = await generate_embedding(query)
    except Exception as exc:
        logger.warning(
            "Embedding generation failed during retrieval; falling back to text-only search",
            extra={"doc_count": len(doc_id_strings), "query": query[:120]},
            exc_info=exc,
        )
        query_embedding = None

    vector_results: list[dict[str, Any]] = []
    if query_embedding is not None:
        vector_results = await _vector_search(query_embedding, doc_id_strings, db, limit=20)
    fts_results = await _fulltext_search(query, doc_id_strings, db, limit=20)

    fused = _reciprocal_rank_fusion([vector_results, fts_results], top_n=top_k)
    filtered = [r for r in fused if r["score"] >= RETRIEVAL_SCORE_THRESHOLD]
    if filtered:
        return filtered
    if fts_results:
        logger.info(
            "Hybrid retrieval returned no results above threshold; using full-text fallback",
            extra={"doc_count": len(doc_id_strings), "fts_results": len(fts_results)},
        )
        return fts_results[:top_k]
    if vector_results:
        logger.info(
            "Hybrid retrieval returned no thresholded or text results; using vector fallback",
            extra={"doc_count": len(doc_id_strings), "vector_results": len(vector_results)},
        )
        return vector_results[:top_k]
    return []


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
        WHERE document_id IN :doc_ids
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """).bindparams(bindparam("doc_ids", expanding=True))
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
        WHERE document_id IN :doc_ids
          AND to_tsvector('indonesian', chunk_text) @@ plainto_tsquery('indonesian', :query)
        ORDER BY score DESC
        LIMIT :limit
    """).bindparams(bindparam("doc_ids", expanding=True))
    result = await db.execute(stmt, {"query": query, "doc_ids": doc_id_strings, "limit": limit})
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
