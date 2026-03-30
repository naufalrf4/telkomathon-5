import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await _ensure_seed_user()
    yield


async def _ensure_seed_user() -> None:
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.features.auth.models import User
    from app.features.auth.service import hash_password

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.username == settings.SEED_USER_USERNAME)
        )
        if result.scalar_one_or_none() is not None:
            return
        user = User(
            username=settings.SEED_USER_USERNAME,
            full_name=settings.SEED_USER_FULL_NAME,
            email=settings.SEED_USER_EMAIL,
            hashed_password=hash_password(settings.SEED_USER_PASSWORD),
        )
        session.add(user)
        await session.commit()
        logger.info("Seed user '%s' created", settings.SEED_USER_USERNAME)


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

    from app.features.auth.router import router as auth_router
    from app.features.chat.router import router as chat_router
    from app.features.design_sessions.router import router as design_sessions_router
    from app.features.documents.router import router as documents_router
    from app.features.export.router import router as export_router
    from app.features.history.router import router as history_router
    from app.features.personalize.router import router as personalize_router
    from app.features.roadmap.router import router as roadmap_router
    from app.features.syllabus.router import router as syllabus_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])
    app.include_router(
        design_sessions_router,
        prefix="/api/v1/design-sessions",
        tags=["design-sessions"],
    )
    app.include_router(syllabus_router, prefix="/api/v1/syllabi", tags=["syllabi"])
    app.include_router(personalize_router, prefix="/api/v1/personalize", tags=["personalize"])
    app.include_router(roadmap_router, prefix="/api/v1/roadmaps", tags=["roadmaps"])
    app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
    app.include_router(export_router, prefix="/api/v1/export", tags=["export"])
    app.include_router(history_router, prefix="/api/v1", tags=["history"])

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
