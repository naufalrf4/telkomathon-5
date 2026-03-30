import uuid

from fastapi import APIRouter, Depends

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.design_sessions.dependencies import get_design_session_service
from app.features.design_sessions.schemas import (
    CourseContextRequest,
    DesignSessionCreateRequest,
    DesignSessionResponse,
    ELOSelectionRequest,
    OptionSelectionRequest,
)
from app.features.design_sessions.service import DesignSessionService
from app.features.syllabus.schemas import SyllabusResponse
from app.response import success_response

router = APIRouter(tags=["design-sessions"])


@router.get("/")
async def list_design_sessions(
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    sessions = await service.list_sessions(owner_id=current_user.id)
    serialized = [
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json")
        for session in sessions
    ]
    return success_response({"sessions": serialized, "total": len(serialized)})


@router.post("/")
async def create_design_session(
    request: DesignSessionCreateRequest,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.create_session(request, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "Design session created successfully",
    )


@router.get("/{session_id}")
async def get_design_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.get_session(session_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json")
    )


@router.post("/{session_id}/start-assist")
async def start_assist(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.start_assist(session_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "Design session summary generated successfully",
    )


@router.patch("/{session_id}/course-context")
async def update_course_context(
    session_id: uuid.UUID,
    request: CourseContextRequest,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.update_course_context(session_id, request, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "Course context updated successfully",
    )


@router.post("/{session_id}/tlo-options")
async def generate_tlo_options(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.generate_tlo_options(session_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "TLO options generated successfully",
    )


@router.patch("/{session_id}/tlo-selection")
async def select_tlo(
    session_id: uuid.UUID,
    request: OptionSelectionRequest,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.select_tlo(session_id, request.option_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "TLO selected successfully",
    )


@router.post("/{session_id}/performance-options")
async def generate_performance_options(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.generate_performance_options(session_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "Performance options generated successfully",
    )


@router.patch("/{session_id}/performance-selection")
async def select_performance(
    session_id: uuid.UUID,
    request: OptionSelectionRequest,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.select_performance(
        session_id, request.option_id, owner_id=current_user.id
    )
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "Performance option selected successfully",
    )


@router.post("/{session_id}/elo-options")
async def generate_elo_options(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.generate_elo_options(session_id, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "ELO options generated successfully",
    )


@router.patch("/{session_id}/elo-selection")
async def select_elos(
    session_id: uuid.UUID,
    request: ELOSelectionRequest,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session = await service.select_elos(session_id, request.option_ids, owner_id=current_user.id)
    return success_response(
        DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
        "ELO options selected successfully",
    )


@router.post("/{session_id}/finalize")
async def finalize_design_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DesignSessionService = Depends(get_design_session_service),
) -> dict[str, object]:
    session, syllabus = await service.finalize(session_id, owner_id=current_user.id)
    return success_response(
        {
            "session": DesignSessionResponse.from_orm_with_coerce(session).model_dump(mode="json"),
            "syllabus": SyllabusResponse.from_orm_with_coerce(syllabus).model_dump(mode="json"),
        },
        "Design session finalized successfully",
    )
