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
    MAX_DOCUMENT_TEXT_CHARS: int = 200000
    MAX_PDF_PARSE_PAGES: int = 80
    CORS_ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8081,"
        "http://127.0.0.1:8081,"
        "http://localhost:19006,"
        "http://127.0.0.1:19006"
    )

    # Auth settings
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    JWT_ALGORITHM: str = "HS256"
    SEED_USER_USERNAME: str = "telkomathon5@nrfdev.space"
    SEED_USER_FULL_NAME: str = "Telkomathon 5"
    SEED_USER_EMAIL: str = "telkomathon5@nrfdev.space"
    SEED_USER_PASSWORD: str = "T3lkomathon5"

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
