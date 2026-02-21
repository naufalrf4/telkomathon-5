import asyncio

from app.ai.client import get_azure_client
from app.config import settings
from app.exceptions import AIServiceException


async def generate_embedding(text: str) -> list[float]:
    client = get_azure_client()
    try:
        response = await client.embeddings.create(
            input=text,
            model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        return response.data[0].embedding
    except Exception as exc:
        raise AIServiceException(f"Embedding generation failed: {exc}") from exc


async def generate_embeddings_batch(
    texts: list[str],
    batch_size: int = 20,
) -> list[list[float]]:
    client = get_azure_client()
    results: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            response = await client.embeddings.create(
                input=batch,
                model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
                dimensions=settings.EMBEDDING_DIMENSIONS,
            )
            sorted_data = sorted(response.data, key=lambda x: x.index)
            results.extend([item.embedding for item in sorted_data])
            if i + batch_size < len(texts):
                await asyncio.sleep(0.1)
        except Exception as exc:
            raise AIServiceException(
                f"Batch embedding failed at batch {i}: {exc}"
            ) from exc

    return results
