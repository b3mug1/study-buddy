import asyncio
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth
from app.schemas import LoginRequest, RegisterRequest


def test_access_and_refresh_jwts_are_type_bound_and_expire(monkeypatch) -> None:
    monkeypatch.setattr(
        auth,
        "_settings_with_secret",
        lambda: SimpleNamespace(jwt_secret_key="x" * 48),
    )
    expiry = datetime.now(UTC) + timedelta(minutes=1)
    access = auth._encode_token(
        "00000000-0000-0000-0000-000000000001",
        "access",
        expiry,
        token_id="session-id",
    )

    payload = auth._decode_token(access, "access")
    assert payload["jti"] == "session-id"
    with pytest.raises(HTTPException) as error:
        auth._decode_token(access, "refresh")
    assert error.value.status_code == 401


def test_auth_schemas_validate_email_and_password_length() -> None:
    with pytest.raises(ValueError):
        RegisterRequest(
            full_name="Alex Student",
            email="not-an-email",
            password="a sufficiently long password",
        )
    with pytest.raises(ValueError):
        LoginRequest(email="123456@astanait.edu.kz", password="short")


def test_passwords_are_argon2_hashed_not_stored_as_plain_text() -> None:
    password = "a sufficiently long password"
    password_hash = auth.password_hasher.hash(password)

    assert password_hash != password
    assert password_hash.startswith("$argon2")
    assert auth.password_hasher.verify(password_hash, password)


def test_registration_creates_an_account_without_email_delivery(monkeypatch) -> None:
    queries = []

    class Query:
        def fetchone(self):
            return {"id": UUID("00000000-0000-0000-0000-000000000001")}

    class Connection:
        def execute(self, query, _params):
            queries.append(query)
            return Query()

    @contextmanager
    def fake_connection():
        yield Connection()

    monkeypatch.setattr(
        auth,
        "_settings_with_secret",
        lambda: SimpleNamespace(jwt_secret_key="x" * 48),
    )
    monkeypatch.setattr(auth, "_enforce_auth_rate_limit", lambda *_args: None)
    monkeypatch.setattr(auth, "database_connection", fake_connection)

    result = auth.register(
        RegisterRequest(
            full_name="Alex Student",
            email="123456@astanait.edu.kz",
            password="a sufficiently long password",
        )
    )

    assert result["detail"] == "Account created. You can now sign in."
    assert "email_verified" not in queries[0]
    assert all("verification" not in query for query in queries)


def test_existing_account_can_use_access_token_without_email_verification(monkeypatch) -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    session_id = UUID("00000000-0000-0000-0000-000000000002")

    class Query:
        def fetchone(self):
            return {"id": user_id, "email": "123456@astanait.edu.kz"}

    class Connection:
        def execute(self, _query, _params):
            return Query()

    @contextmanager
    def fake_connection():
        yield Connection()

    monkeypatch.setattr(auth, "database_connection", fake_connection)
    monkeypatch.setattr(
        auth,
        "_decode_token",
        lambda *_args: {"sub": str(user_id), "jti": str(session_id)},
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test")

    user = asyncio.run(auth.get_current_user(credentials))
    assert user.id == str(user_id)
    assert user.email == "123456@astanait.edu.kz"


def test_existing_account_can_sign_in_without_email_verification(monkeypatch) -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    password = "a sufficiently long password"
    password_hash = auth.password_hasher.hash(password)

    class Query:
        def fetchone(self):
            return {
                "id": user_id,
                "email": "123456@astanait.edu.kz",
                "password_hash": password_hash,
                "disabled_at": None,
            }

    class Connection:
        def execute(self, _query, _params):
            return Query()

    @contextmanager
    def fake_connection():
        yield Connection()

    monkeypatch.setattr(auth, "_settings_with_secret", lambda: SimpleNamespace())
    monkeypatch.setattr(auth, "_enforce_auth_rate_limit", lambda *_args: None)
    monkeypatch.setattr(auth, "database_connection", fake_connection)
    monkeypatch.setattr(auth, "_create_tokens", lambda uid, email: (uid, email))

    result = auth.login(
        LoginRequest(email="123456@astanait.edu.kz", password=password)
    )

    assert result == (user_id, "123456@astanait.edu.kz")
