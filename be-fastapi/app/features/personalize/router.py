import uuid

from fastapi import APIRouter, Depends

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.personalize.dependencies import get_personalize_service
from app.features.personalize.schemas import (
    BulkPersonalizationListResponse,
    BulkPersonalizeRequest,
    PersonalizeRequest,
)
from app.features.personalize.service import PersonalizeService
from app.response import success_response

router = APIRouter(tags=["personalize"])


@router.post("/{syllabus_id}")
async def analyze_and_recommend(
    syllabus_id: uuid.UUID,
    request: PersonalizeRequest,
    current_user: User = Depends(get_current_user),
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    result = await service.analyze_and_recommend(syllabus_id, request, owner_id=current_user.id)
    return success_response(result.model_dump(), "Analysis complete")


@router.post("/{syllabus_id}/bulk")
async def analyze_and_recommend_bulk(
    syllabus_id: uuid.UUID,
    request: BulkPersonalizeRequest,
    current_user: User = Depends(get_current_user),
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    result = await service.analyze_and_recommend_bulk(
        syllabus_id, request, owner_id=current_user.id
    )
    return success_response(result.model_dump(mode="json"), "Bulk analysis complete")


@router.get("/{syllabus_id}")
async def get_personalization(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    result = await service.get_personalization(syllabus_id, owner_id=current_user.id)
    return success_response(result.model_dump(mode="json") if result is not None else None)


@router.get("/{syllabus_id}/bulk")
async def get_bulk_personalization(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: PersonalizeService = Depends(get_personalize_service),
) -> dict[str, object]:
    results = await service.get_bulk_personalizations(syllabus_id, owner_id=current_user.id)
    return success_response(
        BulkPersonalizationListResponse(
            syllabus_id=syllabus_id,
            total=len(results),
            results=results,
        ).model_dump(mode="json")
    )
