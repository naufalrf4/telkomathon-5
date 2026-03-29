from typing import TYPE_CHECKING

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    AZURE_OPENAI_API_KEY: str
    AZURE_OPENAI_ENDPOINT: str
    AZURE_OPENAI_CHAT_DEPLOYMENT: str
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str
    AZURE_OPENAI_API_VERSION: str = "2024-02-01"
    EMBEDDING_DIMENSIONS: int = 3072
    SIMILARITY_THRESHOLD: float = 0.75
    MAX_CHAT_HISTORY: int = 10
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 100
    CORS_ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8081,"
        "http://127.0.0.1:8081,"
        "http://localhost:19006,"
        "http://127.0.0.1:19006"
    )

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]


if TYPE_CHECKING:
    settings = Settings(
        DATABASE_URL="",
        AZURE_OPENAI_API_KEY="",
        AZURE_OPENAI_ENDPOINT="",
        AZURE_OPENAI_CHAT_DEPLOYMENT="",
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT="",
    )
else:
    settings = Settings()
