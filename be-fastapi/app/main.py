import os
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.exceptions import register_exception_handlers
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="MyDigiLearn API",
        description="AI-Powered Curriculum Design & Personalized Micro-Learning",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    from app.features.documents.router import router as documents_router
    from app.features.syllabus.router import router as syllabus_router
    from app.features.personalize.router import router as personalize_router
    from app.features.chat.router import router as chat_router
    from app.features.export.router import router as export_router

    app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])
    app.include_router(syllabus_router, prefix="/api/v1/syllabi", tags=["syllabi"])
    app.include_router(
        personalize_router, prefix="/api/v1/personalize", tags=["personalize"]
    )
    app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
    app.include_router(export_router, prefix="/api/v1/export", tags=["export"])

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
