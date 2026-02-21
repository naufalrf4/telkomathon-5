from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def export_health() -> dict[str, str]:
    return {"feature": "export"}
