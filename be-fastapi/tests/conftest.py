import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

_ = os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
_ = os.environ.setdefault("AZURE_OPENAI_API_KEY", "test-key")
_ = os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
_ = os.environ.setdefault("AZURE_OPENAI_CHAT_DEPLOYMENT", "test-chat")
_ = os.environ.setdefault("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "test-embedding")
_ = os.environ.setdefault("AZURE_OPENAI_API_VERSION", "2024-02-01")
_ = os.environ.setdefault("UPLOAD_DIR", "test-uploads")
