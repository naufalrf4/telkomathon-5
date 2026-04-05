from openai import AsyncAzureOpenAI

from app.config import settings

_client: AsyncAzureOpenAI | None = None


def get_azure_client() -> AsyncAzureOpenAI:
    global _client
    if _client is None:
        _client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            timeout=settings.AZURE_OPENAI_TIMEOUT_SECONDS,
            max_retries=settings.AZURE_OPENAI_MAX_RETRIES,
        )
    return _client
