from fastapi import APIRouter, Depends

from app.features.auth.dependencies import get_auth_service, get_current_user
from app.features.auth.models import User
from app.features.auth.schemas import (
    AuthSessionResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.features.auth.service import AuthService, create_access_token
from app.response import success_response

router = APIRouter(tags=["auth"])


@router.post("/register", status_code=201)
async def register(
    request: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> dict[str, object]:
    user = await service.register(
        full_name=request.full_name,
        email=request.email,
        password=request.password,
    )
    token = create_access_token(user.id)
    session = AuthSessionResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
    return success_response(
        session.model_dump(mode="json"),
        "Registration successful",
    )


@router.post("/login")
async def login(
    request: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> dict[str, object]:
    user = await service.authenticate(
        email=request.email,
        password=request.password,
    )
    token = create_access_token(user.id)
    session = AuthSessionResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
    return success_response(
        session.model_dump(mode="json"),
        "Login successful",
    )


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    return success_response(
        UserResponse.model_validate(current_user).model_dump(mode="json"),
    )
