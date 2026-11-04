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


def test_registration_does_not_issue_a_session_before_email_verification(monkeypatch) -> None:
    queries = []
    sent = []

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
    monkeypatch.setattr(auth, "_email_settings", lambda: SimpleNamespace())
    monkeypatch.setattr(auth, "_enforce_auth_rate_limit", lambda *_args: None)
    monkeypatch.setattr(auth, "database_connection", fake_connection)
    monkeypatch.setattr(auth, "_send_verification_email", lambda *args: sent.append(args))
    monkeypatch.setattr(
        auth,
        "_create_tokens",
        lambda *_args: pytest.fail("unverified account received a session"),
    )

    result = auth.register(
        RegisterRequest(
            full_name="Alex Student",
            email="123456@astanait.edu.kz",
            password="a sufficiently long password",
        )
    )

    assert "verification link" in result["detail"]
    assert len(sent) == 1
    assert "false" in queries[0]
    assert "delete from email_verification_tokens" in queries[2]


def test_unverified_account_cannot_use_an_existing_access_token(monkeypatch) -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    session_id = UUID("00000000-0000-0000-0000-000000000002")

    class Query:
        def fetchone(self):
            return {"id": user_id, "email": "123456@astanait.edu.kz", "email_verified": False}

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

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.get_current_user(credentials))
    assert error.value.status_code == 401
