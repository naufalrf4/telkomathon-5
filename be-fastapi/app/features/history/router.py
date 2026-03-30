import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.history.dependencies import (
    get_decomposition_service,
    get_history_service,
)
from app.features.history.schemas import (
    DecomposeRequest,
    ModuleDecompositionListResponse,
    ModuleDecompositionResponse,
    OwnerHistoryListResponse,
    OwnerHistoryResponse,
    RevisionNoteListResponse,
)
from app.features.history.service import DecompositionService, HistoryService
from app.response import success_response

router = APIRouter(tags=["history"])


# ---------------------------------------------------------------------------
# Owner History
# ---------------------------------------------------------------------------


@router.get("/syllabi/{syllabus_id}/history")
async def get_syllabus_history(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
) -> dict[str, object]:
    items = await service.get_history_for_syllabus(syllabus_id, owner_id=str(current_user.id))
    serialized = [OwnerHistoryResponse.model_validate(i, from_attributes=True) for i in items]
    return success_response(
        OwnerHistoryListResponse(items=serialized, total=len(serialized)).model_dump()
    )


@router.get("/syllabi/{syllabus_id}/revisions")
async def get_syllabus_revisions(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
) -> dict[str, object]:
    items = await service.get_revision_notes(syllabus_id, owner_id=current_user.id)
    return success_response(
        RevisionNoteListResponse(items=items, total=len(items)).model_dump(mode="json")
    )


@router.get("/history/aggregate")
async def get_history_aggregation(
    syllabus_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
) -> dict[str, object]:
    agg = await service.aggregate(owner_id=str(current_user.id), syllabus_id=syllabus_id)
    return success_response(agg.model_dump())


@router.get("/syllabi/{syllabus_id}/history/export.csv")
async def export_history_csv(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: HistoryService = Depends(get_history_service),
) -> Response:
    csv_text = await service.export_history_csv(syllabus_id, owner_id=str(current_user.id))
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=history-{syllabus_id}.csv",
        },
    )


# ---------------------------------------------------------------------------
# Module Decomposition (post-finalize)
# ---------------------------------------------------------------------------


@router.post("/syllabi/{syllabus_id}/decompose")
async def decompose_syllabus(
    syllabus_id: uuid.UUID,
    request: DecomposeRequest | None = None,
    current_user: User = Depends(get_current_user),
    service: DecompositionService = Depends(get_decomposition_service),
) -> dict[str, object]:
    hint = request.module_count_hint if request else None
    modules = await service.decompose(syllabus_id, module_count_hint=hint, owner_id=current_user.id)
    serialized = [ModuleDecompositionResponse.from_orm_coerce(m) for m in modules]
    return success_response(
        ModuleDecompositionListResponse(
            modules=serialized,
            syllabus_id=syllabus_id,
            total=len(serialized),
        ).model_dump(),
        message="Module decomposition generated",
    )


@router.get("/syllabi/{syllabus_id}/modules")
async def get_modules(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DecompositionService = Depends(get_decomposition_service),
) -> dict[str, object]:
    modules = await service.get_decompositions(syllabus_id, owner_id=current_user.id)
    serialized = [ModuleDecompositionResponse.from_orm_coerce(m) for m in modules]
    return success_response(
        ModuleDecompositionListResponse(
            modules=serialized,
            syllabus_id=syllabus_id,
            total=len(serialized),
        ).model_dump()
    )
