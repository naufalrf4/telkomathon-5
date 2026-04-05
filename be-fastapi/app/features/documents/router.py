import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Form, UploadFile

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.documents.dependencies import get_document_service
from app.features.documents.schemas import DocumentDetailResponse, DocumentResponse
from app.features.documents.service import DocumentService, process_document_task
from app.response import success_response

router = APIRouter()


@router.post("/upload", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    doc_type: str = Form(...),
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    doc = await service.upload_document(file, doc_type, owner_id=current_user.id)
    background_tasks.add_task(process_document_task, doc.id)
    data = DocumentResponse.from_document(doc)
    data.chunk_count = len(doc.chunks)
    return success_response(data.model_dump(), "Document accepted and queued for processing")


@router.post("/{document_id}/retry", status_code=202)
async def retry_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    doc = await service.retry_document(document_id, owner_id=current_user.id)
    background_tasks.add_task(process_document_task, doc.id)
    data = DocumentResponse.from_document(doc)
    data.chunk_count = len(doc.chunks)
    return success_response(data.model_dump(), "Document requeued for processing")


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    docs = await service.get_documents(owner_id=current_user.id)
    items = []
    for doc in docs:
        resp = DocumentResponse.from_document(doc)
        resp.chunk_count = len(doc.chunks)
        items.append(resp.model_dump())
    return success_response({"documents": items, "total": len(docs)})


@router.get("/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    doc = await service.get_document(document_id, owner_id=current_user.id)
    base = DocumentResponse.from_document(doc)
    resp = DocumentDetailResponse.model_validate(
        {
            **base.model_dump(),
            "content_text": doc.content_text,
            "metadata_": doc.metadata_,
        }
    )
    resp.chunk_count = len(doc.chunks)
    return success_response(resp.model_dump())


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> None:
    await service.delete_document(document_id, owner_id=current_user.id)
