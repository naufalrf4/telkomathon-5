import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import bcrypt
import jwt
from sqlalchemy import or_, select

from app.config import settings
from app.exceptions import AuthenticationException, DuplicateException, NotFoundException
from app.features.auth.models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise AuthenticationException("Invalid token payload")
        return uuid.UUID(user_id_str)
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationException("Token has expired") from exc
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise AuthenticationException("Invalid token") from exc


class AuthService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def register(
        self,
        *,
        full_name: str,
        email: str,
        password: str,
    ) -> User:
        normalized_email = email.strip().lower()
        normalized_full_name = full_name.strip()
        username = normalized_email
        result = await self.db.execute(
            select(User).where(or_(User.username == username, User.email == normalized_email))
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            raise DuplicateException(f"Email '{normalized_email}' already registered")

        user = User(
            username=username,
            full_name=normalized_full_name,
            email=normalized_email,
            hashed_password=hash_password(password),
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def authenticate(self, *, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        result = await self.db.execute(select(User).where(User.email == normalized_email))
        user = cast(User | None, result.scalar_one_or_none())
        if user is None or not verify_password(password, user.hashed_password):
            raise AuthenticationException("Invalid email or password")
        if not user.is_active:
            raise AuthenticationException("User account is inactive")
        return user

    async def get_user_by_id(self, user_id: uuid.UUID) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = cast(User | None, result.scalar_one_or_none())
        if user is None:
            raise NotFoundException("User", str(user_id))
        return user
