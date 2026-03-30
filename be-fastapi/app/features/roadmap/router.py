import uuid

from fastapi import APIRouter, Depends

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.roadmap.dependencies import get_roadmap_service
from app.features.roadmap.schemas import CareerRoadmapListResponse, CareerRoadmapRequest
from app.features.roadmap.service import CareerRoadmapService
from app.response import success_response

router = APIRouter(tags=["roadmap"])


@router.post("/{syllabus_id}")
async def create_roadmap(
    syllabus_id: uuid.UUID,
    request: CareerRoadmapRequest,
    current_user: User = Depends(get_current_user),
    service: CareerRoadmapService = Depends(get_roadmap_service),
) -> dict[str, object]:
    result = await service.create_roadmap(syllabus_id, request, owner_id=current_user.id)
    return success_response(result.model_dump(mode="json"), "Career roadmap generated")


@router.get("/{syllabus_id}")
async def list_roadmaps(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: CareerRoadmapService = Depends(get_roadmap_service),
) -> dict[str, object]:
    results = await service.list_roadmaps(syllabus_id, owner_id=current_user.id)
    return success_response(
        CareerRoadmapListResponse(
            syllabus_id=syllabus_id,
            total=len(results),
            results=results,
        ).model_dump(mode="json")
    )
