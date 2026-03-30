import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.export.dependencies import get_export_service
from app.features.export.service import ExportService
from app.features.history.dependencies import get_history_service
from app.features.history.service import HistoryService
from app.features.syllabus.dependencies import get_syllabus_service
from app.features.syllabus.generator import generate_syllabus_stream
from app.features.syllabus.schemas import (
    SyllabusGenerateRequest,
    SyllabusResponse,
    SyllabusRevisionApplyRequest,
)
from app.features.syllabus.service import SyllabusService
from app.response import success_response

router = APIRouter(tags=["syllabi"])


@router.post("/generate")
async def generate_syllabus(
    request: SyllabusGenerateRequest,
    current_user: User = Depends(get_current_user),
    service: SyllabusService = Depends(get_syllabus_service),
) -> EventSourceResponse:
    owner_id = current_user.id

    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        full_response = ""
        syllabus_id: str | None = None
        try:
            async for chunk in generate_syllabus_stream(request, service.db):
                if chunk.startswith("\n__DONE__:"):
                    full_response = chunk[len("\n__DONE__:") :]
                    syllabus = await service.create_syllabus_from_stream(
                        request, full_response, owner_id=owner_id
                    )
                    await service.db.commit()
                    syllabus_id = str(syllabus.id)
                else:
                    yield {"event": "chunk", "data": chunk}
            yield {
                "event": "done",
                "data": json.dumps({"syllabus_id": syllabus_id}),
            }
        except Exception as exc:
            yield {"event": "error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(event_generator())


@router.get("/")
async def list_syllabi(
    current_user: User = Depends(get_current_user),
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabi = await service.get_syllabi(owner_id=current_user.id)
    serialized = [SyllabusResponse.from_orm_with_coerce(s).model_dump() for s in syllabi]
    return success_response({"syllabi": serialized, "total": len(syllabi)})


@router.get("/{syllabus_id}")
async def get_syllabus(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabus = await service.get_syllabus(syllabus_id, owner_id=current_user.id)
    return success_response(SyllabusResponse.from_orm_with_coerce(syllabus).model_dump())


@router.post("/{syllabus_id}/apply-revision")
async def apply_revision(
    syllabus_id: uuid.UUID,
    request: SyllabusRevisionApplyRequest,
    current_user: User = Depends(get_current_user),
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabus = await service.apply_revision(syllabus_id, request, owner_id=current_user.id)
    return success_response(
        SyllabusResponse.from_orm_with_coerce(syllabus).model_dump(),
        message="Revision applied successfully",
    )


@router.get("/{syllabus_id}/download.docx")
async def download_syllabus_docx(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: ExportService = Depends(get_export_service),
    syllabus_service: SyllabusService = Depends(get_syllabus_service),
    history_service: HistoryService = Depends(get_history_service),
) -> Response:
    docx_bytes = await service.generate_docx(syllabus_id, owner_id=current_user.id)
    syllabus = await syllabus_service.get_syllabus(syllabus_id, owner_id=current_user.id)
    await history_service.record_event(
        syllabus_id=syllabus_id,
        owner_id=str(current_user.id),
        action="exported",
        summary="Downloaded DOCX export",
        detail={"format": "docx"},
        revision_index=len(syllabus.revision_history or []),
    )
    return Response(
        content=docx_bytes,
        media_type=("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        headers={"Content-Disposition": (f"attachment; filename=syllabus-{syllabus_id}.docx")},
    )
