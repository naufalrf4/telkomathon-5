import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.features.export.dependencies import get_export_service
from app.features.export.service import ExportService

router = APIRouter(tags=["export"])


@router.get("/{syllabus_id}/pdf")
async def export_pdf(
    syllabus_id: uuid.UUID,
    service: ExportService = Depends(get_export_service),
) -> Response:
    pdf_bytes = await service.generate_pdf(syllabus_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=syllabus-{syllabus_id}.pdf"},
    )
