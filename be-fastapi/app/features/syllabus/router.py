import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from app.features.export.dependencies import get_export_service
from app.features.export.service import ExportService
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
    service: SyllabusService = Depends(get_syllabus_service),
) -> EventSourceResponse:
    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        full_response = ""
        syllabus_id: str | None = None
        try:
            async for chunk in generate_syllabus_stream(request, service.db):
                if chunk.startswith("\n__DONE__:"):
                    full_response = chunk[len("\n__DONE__:") :]
                    syllabus = await service.create_syllabus_from_stream(request, full_response)
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
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabi = await service.get_syllabi()
    serialized = [SyllabusResponse.from_orm_with_coerce(s).model_dump() for s in syllabi]
    return success_response({"syllabi": serialized, "total": len(syllabi)})


@router.get("/{syllabus_id}")
async def get_syllabus(
    syllabus_id: uuid.UUID,
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabus = await service.get_syllabus(syllabus_id)
    return success_response(SyllabusResponse.from_orm_with_coerce(syllabus).model_dump())


@router.post("/{syllabus_id}/apply-revision")
async def apply_revision(
    syllabus_id: uuid.UUID,
    request: SyllabusRevisionApplyRequest,
    service: SyllabusService = Depends(get_syllabus_service),
) -> dict[str, object]:
    syllabus = await service.apply_revision(syllabus_id, request)
    return success_response(
        SyllabusResponse.from_orm_with_coerce(syllabus).model_dump(),
        message="Revision applied successfully",
    )


@router.get("/{syllabus_id}/download.docx")
async def download_syllabus_docx(
    syllabus_id: uuid.UUID,
    service: ExportService = Depends(get_export_service),
) -> Response:
    docx_bytes = await service.generate_docx(syllabus_id)
    return Response(
        content=docx_bytes,
        media_type=("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        headers={"Content-Disposition": (f"attachment; filename=syllabus-{syllabus_id}.docx")},
    )
