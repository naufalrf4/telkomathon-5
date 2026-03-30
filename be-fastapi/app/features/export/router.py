import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.export.dependencies import get_export_service
from app.features.export.service import ExportService
from app.features.history.dependencies import get_history_service
from app.features.history.service import HistoryService
from app.features.syllabus.dependencies import get_syllabus_service
from app.features.syllabus.service import SyllabusService

router = APIRouter(tags=["export"])


@router.get("/{syllabus_id}/pdf")
async def export_pdf(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: ExportService = Depends(get_export_service),
    syllabus_service: SyllabusService = Depends(get_syllabus_service),
    history_service: HistoryService = Depends(get_history_service),
) -> Response:
    pdf_bytes = await service.generate_pdf(syllabus_id, owner_id=current_user.id)
    syllabus = await syllabus_service.get_syllabus(syllabus_id, owner_id=current_user.id)
    await history_service.record_event(
        syllabus_id=syllabus_id,
        owner_id=str(current_user.id),
        action="exported",
        summary="Downloaded PDF export",
        detail={"format": "pdf"},
        revision_index=len(syllabus.revision_history or []),
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=syllabus-{syllabus_id}.pdf"},
    )
