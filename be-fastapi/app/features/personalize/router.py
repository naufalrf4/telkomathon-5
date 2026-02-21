import uuid

from fastapi import APIRouter, Depends

from app.features.personalize.dependencies import get_personalize_service
from app.features.personalize.schemas import PersonalizeRequest
from app.features.personalize.service import PersonalizeService
from app.response import success_response

router = APIRouter(tags=["personalize"])


@router.post("/{syllabus_id}")
async def analyze_and_recommend(
    syllabus_id: uuid.UUID,
    request: PersonalizeRequest,
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    result = await service.analyze_and_recommend(syllabus_id, request)
    return success_response(result.model_dump(), "Analysis complete")


@router.get("/{syllabus_id}")
async def get_personalization(
    syllabus_id: uuid.UUID,
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    result = await service.get_personalization(syllabus_id)
    return success_response(result.model_dump())
