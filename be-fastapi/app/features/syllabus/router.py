import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.syllabus.dependencies import get_revision_chat_service, get_syllabus_service
from app.features.syllabus.export_service import SyllabusExportService
from app.features.syllabus.revision_service import RevisionChatService
from app.features.syllabus.schemas import (
    ChatHistoryResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    SectionDecisionRequest,
    SyllabusResponse,
    SyllabusRevisionApplyRequest,
)
from app.features.syllabus.service import SyllabusService
from app.response import success_response

router = APIRouter(tags=["syllabi"])


def get_syllabus_export_service(
    service: SyllabusService = Depends(get_syllabus_service),
) -> SyllabusExportService:
    return SyllabusExportService(service.db)


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
    export_service: SyllabusExportService = Depends(get_syllabus_export_service),
) -> Response:
    docx_bytes = await export_service.generate_docx(syllabus_id, owner_id=current_user.id)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="syllabus-{syllabus_id}.docx"',
        },
    )


@router.get("/{syllabus_id}/download.pdf")
async def download_syllabus_pdf(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    export_service: SyllabusExportService = Depends(get_syllabus_export_service),
) -> Response:
    pdf_bytes = await export_service.generate_pdf(syllabus_id, owner_id=current_user.id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="syllabus-{syllabus_id}.pdf"',
        },
    )


# ---------- Chat-based revision endpoints ----------


@router.post("/{syllabus_id}/chat")
async def send_chat_message(
    syllabus_id: uuid.UUID,
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    revision_service: RevisionChatService = Depends(get_revision_chat_service),
) -> dict[str, object]:
    message = await revision_service.send_message(
        syllabus_id, request.content, owner_id=current_user.id
    )
    return success_response(ChatMessageResponse.model_validate(message).model_dump(mode="json"))


@router.get("/{syllabus_id}/chat")
async def get_chat_history(
    syllabus_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    revision_service: RevisionChatService = Depends(get_revision_chat_service),
) -> dict[str, object]:
    messages = await revision_service.get_history(syllabus_id, owner_id=current_user.id)
    response = ChatHistoryResponse(
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
        syllabus_id=syllabus_id,
    )
    return success_response(response.model_dump(mode="json"))


@router.post("/{syllabus_id}/chat/{message_id}/accept")
async def accept_chat_revision(
    syllabus_id: uuid.UUID,
    message_id: uuid.UUID,
    request: SectionDecisionRequest,
    current_user: User = Depends(get_current_user),
    revision_service: RevisionChatService = Depends(get_revision_chat_service),
) -> dict[str, object]:
    syllabus = await revision_service.accept_revision(
        syllabus_id,
        message_id,
        request.section_key,
        owner_id=current_user.id,
    )
    return success_response(
        SyllabusResponse.from_orm_with_coerce(syllabus).model_dump(mode="json"),
        message="Revision accepted",
    )


@router.post("/{syllabus_id}/chat/{message_id}/reject")
async def reject_chat_revision(
    syllabus_id: uuid.UUID,
    message_id: uuid.UUID,
    request: SectionDecisionRequest,
    current_user: User = Depends(get_current_user),
    revision_service: RevisionChatService = Depends(get_revision_chat_service),
) -> dict[str, object]:
    message = await revision_service.reject_revision(
        syllabus_id,
        message_id,
        request.section_key,
        owner_id=current_user.id,
    )
    return success_response(
        ChatMessageResponse.model_validate(message).model_dump(mode="json"),
        message="Revision rejected",
    )
