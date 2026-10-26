from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

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
        LoginRequest(email="alex@example.edu", password="short")


def test_passwords_are_argon2_hashed_not_stored_as_plain_text() -> None:
    password = "a sufficiently long password"
    password_hash = auth.password_hasher.hash(password)

    assert password_hash != password
    assert password_hash.startswith("$argon2")
    assert auth.password_hasher.verify(password_hash, password)
