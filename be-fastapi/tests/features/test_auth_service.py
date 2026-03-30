from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from app.exceptions import AuthenticationException, DuplicateException, NotFoundException
from app.features.auth.models import User
from app.features.auth.service import (
    AuthService,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_hash_password_produces_bcrypt_hash() -> None:
    hashed = hash_password("mypassword")
    assert hashed.startswith("$2")
    assert len(hashed) == 60


def test_verify_password_correct() -> None:
    hashed = hash_password("secure123")
    assert verify_password("secure123", hashed) is True


def test_verify_password_wrong() -> None:
    hashed = hash_password("secure123")
    assert verify_password("wrong", hashed) is False


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------


def test_create_and_decode_token_roundtrip() -> None:
    user_id = uuid4()
    token = create_access_token(user_id)
    decoded = decode_access_token(token)
    assert decoded == user_id


def test_decode_invalid_token_raises() -> None:
    with pytest.raises(AuthenticationException, match="Invalid token"):
        decode_access_token("not.a.valid.token")


def test_decode_token_missing_sub() -> None:
    import jwt as pyjwt

    from app.config import settings

    token = pyjwt.encode({"foo": "bar"}, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(AuthenticationException, match="Invalid token payload"):
        decode_access_token(token)


def test_decode_expired_token_raises() -> None:
    import jwt as pyjwt

    from app.config import settings

    payload = {"sub": str(uuid4()), "exp": datetime(2020, 1, 1, tzinfo=UTC)}
    token = pyjwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(AuthenticationException, match="expired"):
        decode_access_token(token)


# ---------------------------------------------------------------------------
# AuthService fakes
# ---------------------------------------------------------------------------


class FakeScalarResult:
    def __init__(self, value: object) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object:
        return self._value


class FakeAuthSession:
    def __init__(self, *, existing_user: User | None = None) -> None:
        self._existing_user = existing_user
        self.added: list[Any] = []

    async def execute(self, _statement: object) -> FakeScalarResult:
        return FakeScalarResult(self._existing_user)

    def add(self, obj: object) -> None:
        self.added.append(obj)
        if isinstance(obj, User) and obj.id is None:
            obj.id = uuid4()

    async def flush(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        if isinstance(obj, User) and obj.id is None:
            obj.id = uuid4()


# ---------------------------------------------------------------------------
# AuthService.register
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_creates_user() -> None:
    db = FakeAuthSession(existing_user=None)
    service = AuthService(db)

    user = await service.register(
        full_name="Test User",
        email="test@example.com",
        password="password123",
    )

    assert isinstance(user, User)
    assert user.username == "test@example.com"
    assert user.full_name == "Test User"
    assert user.email == "test@example.com"
    assert user.hashed_password.startswith("$2")
    assert user.id is not None


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email() -> None:
    existing = User(
        id=uuid4(),
        username="taken@example.com",
        full_name="Taken User",
        email="taken@example.com",
        hashed_password=hash_password("pw"),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeAuthSession(existing_user=existing)
    service = AuthService(db)

    with pytest.raises(DuplicateException, match="Email"):
        await service.register(
            full_name="New User",
            email="taken@example.com",
            password="password123",
        )


# ---------------------------------------------------------------------------
# AuthService.authenticate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_authenticate_returns_user_on_valid_credentials() -> None:
    hashed = hash_password("correct_password")
    existing = User(
        id=uuid4(),
        username="login@example.com",
        full_name="Login User",
        email="login@example.com",
        hashed_password=hashed,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeAuthSession(existing_user=existing)
    service = AuthService(db)

    user = await service.authenticate(email="login@example.com", password="correct_password")
    assert user.id == existing.id


@pytest.mark.asyncio
async def test_authenticate_rejects_wrong_password() -> None:
    hashed = hash_password("correct_password")
    existing = User(
        id=uuid4(),
        username="login@example.com",
        full_name="Login User",
        email="login@example.com",
        hashed_password=hashed,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeAuthSession(existing_user=existing)
    service = AuthService(db)

    with pytest.raises(AuthenticationException, match="Invalid email"):
        await service.authenticate(email="login@example.com", password="wrong")


@pytest.mark.asyncio
async def test_authenticate_rejects_nonexistent_user() -> None:
    db = FakeAuthSession(existing_user=None)
    service = AuthService(db)

    with pytest.raises(AuthenticationException, match="Invalid email"):
        await service.authenticate(email="ghost@example.com", password="password123")


@pytest.mark.asyncio
async def test_authenticate_rejects_inactive_user() -> None:
    hashed = hash_password("correct_password")
    existing = User(
        id=uuid4(),
        username="inactive@example.com",
        full_name="Inactive User",
        email="inactive@example.com",
        hashed_password=hashed,
        is_active=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeAuthSession(existing_user=existing)
    service = AuthService(db)

    with pytest.raises(AuthenticationException, match="inactive"):
        await service.authenticate(email="inactive@example.com", password="correct_password")


# ---------------------------------------------------------------------------
# AuthService.get_user_by_id
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_user_by_id_returns_user() -> None:
    user_id = uuid4()
    existing = User(
        id=user_id,
        username="found@example.com",
        full_name="Found User",
        email="found@example.com",
        hashed_password=hash_password("pw"),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db = FakeAuthSession(existing_user=existing)
    service = AuthService(db)

    user = await service.get_user_by_id(user_id)
    assert user.id == user_id


@pytest.mark.asyncio
async def test_get_user_by_id_raises_not_found() -> None:
    db = FakeAuthSession(existing_user=None)
    service = AuthService(db)

    with pytest.raises(NotFoundException):
        await service.get_user_by_id(uuid4())
