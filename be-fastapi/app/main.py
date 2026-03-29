import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="PRIMA API",
        description="Personalized Responsive Intelligent Micro-Learning Assistant",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    from app.features.chat.router import router as chat_router
    from app.features.design_sessions.router import router as design_sessions_router
    from app.features.documents.router import router as documents_router
    from app.features.export.router import router as export_router
    from app.features.personalize.router import router as personalize_router
    from app.features.syllabus.router import router as syllabus_router

    app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])
    app.include_router(
        design_sessions_router,
        prefix="/api/v1/design-sessions",
        tags=["design-sessions"],
    )
    app.include_router(syllabus_router, prefix="/api/v1/syllabi", tags=["syllabi"])
    app.include_router(personalize_router, prefix="/api/v1/personalize", tags=["personalize"])
    app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
    app.include_router(export_router, prefix="/api/v1/export", tags=["export"])

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
