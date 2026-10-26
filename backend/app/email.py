import logging
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)


def _send_email(recipient: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not all(
        (
            settings.smtp_host,
            settings.smtp_username,
            settings.smtp_password,
            settings.smtp_from_email,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured. Set the SMTP environment variables.",
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        logger.exception("SMTP delivery failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We could not send the email right now. Please try again later.",
        ) from error


def send_verification_email(recipient: str, token: str) -> None:
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/auth/verify?{urlencode({'token': token})}"
    _send_email(
        recipient,
        "Verify your Study Buddy email",
        f"Confirm your email to finish creating your Study Buddy account:\n\n{link}\n\n"
        f"This link expires in {settings.verification_token_hours} hours.",
    )


def send_password_reset_email(recipient: str, token: str) -> None:
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?{urlencode({'token': token})}"
    _send_email(
        recipient,
        "Reset your Study Buddy password",
        f"Use this secure link to set a new password:\n\n{link}\n\n"
        f"This link expires in {settings.password_reset_token_minutes} minutes. "
        "If you did not request a reset, you can ignore this email.",
    )
