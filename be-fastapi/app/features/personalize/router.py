from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def personalize_health() -> dict[str, str]:
    return {"feature": "personalize"}
