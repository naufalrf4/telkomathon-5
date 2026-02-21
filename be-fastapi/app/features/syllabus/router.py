from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def syllabus_health() -> dict[str, str]:
    return {"feature": "syllabus"}
