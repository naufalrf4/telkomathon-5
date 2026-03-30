import uuid

from fastapi import APIRouter, Depends, Form, UploadFile

from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.documents.dependencies import get_document_service
from app.features.documents.schemas import DocumentDetailResponse, DocumentResponse
from app.features.documents.service import DocumentService
from app.response import success_response

router = APIRouter()


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile,
    doc_type: str = Form(...),
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    doc = await service.upload_document(file, doc_type, owner_id=current_user.id)
    data = DocumentResponse.model_validate(doc)
    data.chunk_count = len(doc.chunks)
    return success_response(data.model_dump(), "Document uploaded successfully")


@router.get("/")
async def list_documents(
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> dict[str, object]:
    docs = await service.get_documents(owner_id=current_user.id)
    items = []
    for doc in docs:
        resp = DocumentResponse.model_validate(doc)
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
    resp = DocumentDetailResponse.model_validate(doc)
    resp.chunk_count = len(doc.chunks)
    return success_response(resp.model_dump())


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
) -> None:
    await service.delete_document(document_id, owner_id=current_user.id)
