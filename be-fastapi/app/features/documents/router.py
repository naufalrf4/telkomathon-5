from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def documents_health() -> dict[str, str]:
    return {"feature": "documents"}
