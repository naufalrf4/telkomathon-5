from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def chat_health() -> dict[str, str]:
    return {"feature": "chat"}
