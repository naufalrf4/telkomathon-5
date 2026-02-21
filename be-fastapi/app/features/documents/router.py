import uuid

from fastapi import APIRouter, Depends, Form, UploadFile

from app.features.documents.dependencies import get_document_service
from app.features.documents.schemas import DocumentDetailResponse, DocumentResponse
from app.features.documents.service import DocumentService
from app.response import success_response

router = APIRouter()


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile,
    doc_type: str = Form(...),
    service: DocumentService = Depends(get_document_service),
) -> dict:
    doc = await service.upload_document(file, doc_type)
    data = DocumentResponse.model_validate(doc)
    data.chunk_count = len(doc.chunks)
    return success_response(data.model_dump(), "Document uploaded successfully")


@router.get("/")
async def list_documents(
    service: DocumentService = Depends(get_document_service),
) -> dict:
    docs = await service.get_documents()
    items = []
    for doc in docs:
        resp = DocumentResponse.model_validate(doc)
        resp.chunk_count = len(doc.chunks)
        items.append(resp.model_dump())
    return success_response({"documents": items, "total": len(docs)})


@router.get("/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    service: DocumentService = Depends(get_document_service),
) -> dict:
    doc = await service.get_document(document_id)
    resp = DocumentDetailResponse.model_validate(doc)
    resp.chunk_count = len(doc.chunks)
    return success_response(resp.model_dump())


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    service: DocumentService = Depends(get_document_service),
) -> None:
    await service.delete_document(document_id)
