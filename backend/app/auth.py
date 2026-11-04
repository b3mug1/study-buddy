import hashlib
import secrets
import smtplib
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Annotated, Any
from urllib.parse import urlencode, urlsplit
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.database import DatabaseError, PostgresDatabase, database_connection
from app.schemas import (
    AuthTokens,
    AuthUserView,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
password_hasher = PasswordHasher()


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    db: PostgresDatabase


def _settings_with_secret():
    settings = get_settings()
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PostgreSQL is not configured. Set DATABASE_URL.",
        )
    if not settings.jwt_secret_key or len(settings.jwt_secret_key) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Set a JWT_SECRET_KEY containing at least 32 characters.",
        )
    return settings


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _encode_token(
    subject: str,
    token_type: str,
    expires_at: datetime,
    *,
    token_id: str | None = None,
) -> str:
    settings = _settings_with_secret()
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": datetime.now(UTC),
        "exp": expires_at,
    }
    if token_id:
        payload["jti"] = token_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def _create_tokens(user_id: UUID, email: str) -> AuthTokens:
    settings = _settings_with_secret()
    now = datetime.now(UTC)
    access_expiry = now + timedelta(minutes=settings.access_token_minutes)
    refresh_expiry = now + timedelta(days=settings.refresh_token_days)
    session_id = uuid4()
    access_token = _encode_token(
        str(user_id),
        "access",
        access_expiry,
        token_id=str(session_id),
    )
    refresh_token = _encode_token(
        str(user_id),
        "refresh",
        refresh_expiry,
        token_id=str(session_id),
    )

    with database_connection() as connection:
        connection.execute(
            """insert into refresh_sessions(id,user_id,token_hash,expires_at)
               values (%s,%s,%s,%s)""",
            (session_id, user_id, _token_hash(refresh_token), refresh_expiry),
        )

    return AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_minutes * 60,
    )


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = _settings_with_secret()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "type", "exp", "iat"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired. Sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This token cannot be used for that operation.",
        )
    return payload


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = _decode_token(credentials.credentials, "access")
    try:
        session_id = UUID(payload["jti"])
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired. Sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    try:
        with database_connection() as connection:
            user = connection.execute(
                """select u.id,u.email,u.email_verified
                   from users u join refresh_sessions rs on rs.user_id=u.id
                   where u.id=%s and u.disabled_at is null
                     and rs.id=%s and rs.revoked_at is null
                     and rs.expires_at>now()""",
                (user_id, session_id),
            ).fetchone()
    except DatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to validate the session.",
        ) from error

    if not user or not user["email_verified"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired. Sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(
        id=str(user["id"]),
        email=user["email"],
        db=PostgresDatabase(str(user["id"])),
    )


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def _enforce_auth_rate_limit(
    action: str,
    subject: str,
    limit: int,
    window: timedelta,
) -> None:
    subject_hash = _token_hash(f"{action}:{subject.strip().casefold()}")
    try:
        with database_connection() as connection:
            connection.execute(
                "delete from auth_rate_limits where created_at < now()-interval '2 days'"
            )
            connection.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s,0))",
                (f"{action}:{subject_hash}",),
            )
            count = connection.execute(
                """select count(*) as count from auth_rate_limits
                   where action=%s and subject_hash=%s
                     and created_at>=now()-%s::interval""",
                (action, subject_hash, window),
            ).fetchone()["count"]
            if count >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please try again later.",
                )
            connection.execute(
                "insert into auth_rate_limits(action,subject_hash) values (%s,%s)",
                (action, subject_hash),
            )
    except DatabaseError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to check authentication limits right now.",
        ) from error


def _email_settings():
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from or not settings.frontend_url:
        raise HTTPException(status_code=503, detail="Email verification is not configured.")
    frontend = urlsplit(settings.frontend_url)
    if frontend.scheme != "https" and not (
        frontend.scheme == "http" and frontend.hostname in {"localhost", "127.0.0.1"}
    ):
        raise HTTPException(status_code=503, detail="A secure frontend URL is required.")
    if (
        not frontend.hostname
        or frontend.username
        or frontend.password
        or frontend.path not in {"", "/"}
        or frontend.query
        or frontend.fragment
    ):
        raise HTTPException(status_code=503, detail="FRONTEND_URL must be an origin.")
    if not settings.smtp_use_tls and settings.smtp_host not in {"localhost", "127.0.0.1"}:
        raise HTTPException(status_code=503, detail="SMTP TLS is required.")
    if bool(settings.smtp_username) != bool(settings.smtp_password) or (
        settings.smtp_username and not settings.smtp_use_tls
    ):
        raise HTTPException(status_code=503, detail="Secure SMTP credentials are required.")
    return settings


def _send_verification_email(user_id: UUID, email: str) -> None:
    settings = _email_settings()
    token = secrets.token_urlsafe(32)
    with database_connection() as connection:
        connection.execute(
            """insert into email_verification_tokens(user_id,token_hash,expires_at)
               values (%s,%s,%s)""",
            (user_id, _token_hash(token), datetime.now(UTC) + timedelta(hours=24)),
        )
    link = f"{settings.frontend_url.rstrip('/')}/auth/verify?{urlencode({'token': token})}"
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = email
    message["Subject"] = "Verify your Study Buddy email"
    message.set_content(
        "Confirm your university email to activate your account:\n\n"
        f"{link}\n\nThis link expires in 24 hours."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        raise HTTPException(
            status_code=503,
            detail="Verification email could not be sent. Try signing in later to resend it.",
        ) from error


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register(request: RegisterRequest) -> dict[str, str]:
    _settings_with_secret()
    _email_settings()
    _enforce_auth_rate_limit("register", request.email, 20, timedelta(hours=1))
    new_user_id = uuid4()
    try:
        with database_connection() as connection:
            account = connection.execute(
                """insert into users(id,email,password_hash,full_name,email_verified)
                   values (%s,lower(%s),%s,%s,false)
                   on conflict (email) do update set
                     password_hash=excluded.password_hash,
                     full_name=excluded.full_name,updated_at=now()
                   where users.email_verified=false
                   returning id""",
                (
                    new_user_id,
                    request.email,
                    password_hasher.hash(request.password),
                    request.full_name,
                ),
            ).fetchone()
            if not account:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists. Please log in.",
                )
            user_id = account["id"]
            connection.execute(
                """insert into profiles(id,full_name)
                   values (%s,%s)
                   on conflict (id) do update set full_name=excluded.full_name""",
                (user_id, request.full_name),
            )
            connection.execute(
                "delete from email_verification_tokens where user_id=%s",
                (user_id,),
            )
            connection.execute(
                """update refresh_sessions set revoked_at=now()
                   where user_id=%s and revoked_at is null""",
                (user_id,),
            )
    except DatabaseError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please log in.",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create your account right now.",
        ) from error

    _send_verification_email(user_id, request.email.lower())
    return {"detail": "Check your university email for a verification link."}


@router.post("/login", response_model=AuthTokens)
def login(request: LoginRequest) -> AuthTokens:
    _settings_with_secret()
    _enforce_auth_rate_limit("login", request.email, 10, timedelta(hours=1))
    with database_connection() as connection:
        user = connection.execute(
            """select id,email,password_hash,email_verified,disabled_at
               from users where email=lower(%s)""",
            (request.email,),
        ).fetchone()

    if not user or user["disabled_at"] is not None:
        password_hasher.hash(request.password)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )
    try:
        password_hasher.verify(user["password_hash"], request.password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        ) from None
    if not user["email_verified"]:
        _send_verification_email(user["id"], user["email"])
        raise HTTPException(
            status_code=403,
            detail="Check your university email for a verification link. A new link has been sent.",
        )
    return _create_tokens(user["id"], user["email"])


@router.post("/verify-email", response_model=AuthTokens)
def verify_email(request: VerifyEmailRequest) -> AuthTokens:
    _enforce_auth_rate_limit("verify-email", request.token, 10, timedelta(hours=1))
    with database_connection() as connection:
        row = connection.execute(
            """select id,user_id,expires_at,used_at from email_verification_tokens
               where token_hash=%s for update""",
            (_token_hash(request.token),),
        ).fetchone()
        if not row or row["used_at"] is not None or row["expires_at"] <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification link is invalid or expired.",
            )
        connection.execute("update users set email_verified=true where id=%s", (row["user_id"],))
        connection.execute(
            """update refresh_sessions set revoked_at=now()
               where user_id=%s and revoked_at is null""",
            (row["user_id"],),
        )
        connection.execute(
            "update email_verification_tokens set used_at=now() where id=%s",
            (row["id"],),
        )
        user = connection.execute(
            "select id,email from users where id=%s and disabled_at is null", (row["user_id"],)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Account is unavailable.")
    return _create_tokens(user["id"], user["email"])


@router.post("/refresh", response_model=AuthTokens)
def refresh(request: RefreshRequest) -> AuthTokens:
    payload = _decode_token(request.refresh_token, "refresh")
    session_id = payload.get("jti")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )
    with database_connection() as connection:
        session = connection.execute(
            """select rs.id,rs.user_id,rs.expires_at,rs.revoked_at,rs.token_hash,
                      u.email,u.email_verified,u.disabled_at
               from refresh_sessions rs join users u on u.id=rs.user_id
               where rs.id=%s""",
            (UUID(session_id),),
        ).fetchone()
        if (
            not session
            or session["revoked_at"] is not None
            or session["expires_at"] <= datetime.now(UTC)
            or not secrets.compare_digest(session["token_hash"], _token_hash(request.refresh_token))
            or session["disabled_at"] is not None
            or not session["email_verified"]
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session is invalid or has expired. Sign in again.",
            )
        connection.execute(
            "update refresh_sessions set last_used_at=now() where id=%s",
            (UUID(session_id),),
        )
    access_expiry = datetime.now(UTC) + timedelta(minutes=get_settings().access_token_minutes)
    return AuthTokens(
        access_token=_encode_token(
            str(session["user_id"]),
            "access",
            access_expiry,
            token_id=str(session["id"]),
        ),
        refresh_token=request.refresh_token,
        expires_in=get_settings().access_token_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: RefreshRequest) -> None:
    payload = _decode_token(request.refresh_token, "refresh")
    session_id = payload.get("jti")
    if session_id:
        with database_connection() as connection:
            connection.execute(
                """update refresh_sessions set revoked_at=now()
                   where id=%s and token_hash=%s and revoked_at is null""",
                (UUID(session_id), _token_hash(request.refresh_token)),
            )


@router.post("/forgot-password", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def forgot_password(request: ForgotPasswordRequest) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset is unavailable because email delivery is disabled.",
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(request: ResetPasswordRequest) -> None:
    _enforce_auth_rate_limit("reset-password", request.token, 5, timedelta(hours=1))
    with database_connection() as connection:
        token = connection.execute(
            """select id,user_id,expires_at,used_at from password_reset_tokens
               where token_hash=%s for update""",
            (_token_hash(request.token),),
        ).fetchone()
        if not token or token["used_at"] is not None or token["expires_at"] <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset link is invalid or expired.",
            )
        connection.execute(
            "update users set password_hash=%s where id=%s",
            (password_hasher.hash(request.password), token["user_id"]),
        )
        connection.execute(
            "update password_reset_tokens set used_at=now() where id=%s",
            (token["id"],),
        )
        connection.execute(
            """update refresh_sessions set revoked_at=now()
               where user_id=%s and revoked_at is null""",
            (token["user_id"],),
        )


@router.get("/me", response_model=AuthUserView)
def get_me(user: CurrentUser) -> AuthUserView:
    with database_connection(user.id) as connection:
        row = connection.execute(
            "select full_name,email,email_verified from users where id=%s",
            (UUID(user.id),),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found.")
    return AuthUserView(
        id=user.id,
        email=row["email"],
        email_verified=row["email_verified"],
        full_name=row["full_name"],
    )
