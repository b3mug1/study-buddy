import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import psycopg
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.auth import CurrentUser
from app.config import get_settings
from app.database import DatabaseError, database_connection

router = APIRouter(prefix="/api/v1", tags=["realtime"])
logger = logging.getLogger(__name__)
TICKET_LIFETIME = timedelta(seconds=30)


def _hash_ticket(ticket: str) -> str:
    return hashlib.sha256(ticket.encode("utf-8")).hexdigest()


@router.post("/conversations/{conversation_id}/ws-ticket")
def create_websocket_ticket(conversation_id: UUID, user: CurrentUser) -> dict[str, str]:
    ticket = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + TICKET_LIFETIME
    with database_connection(user.id) as connection:
        connection.execute(
            "select pg_advisory_xact_lock(hashtextextended(%s,0))",
            (f"websocket-ticket:{user.id}",),
        )
        ticket_count = connection.execute(
            """select count(*) as count from websocket_tickets
               where user_id=%s and created_at>now()-interval '1 hour'""",
            (UUID(user.id),),
        ).fetchone()["count"]
        if ticket_count >= 120:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Realtime connections are being requested too frequently.",
            )
        connection.execute("delete from websocket_tickets where expires_at<now()-interval '1 day'")
        membership = connection.execute(
            """select 1 from conversation_members
               where conversation_id=%s and student_id=%s""",
            (conversation_id, UUID(user.id)),
        ).fetchone()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or you are not a member.",
            )
        connection.execute(
            """insert into websocket_tickets
               (user_id,conversation_id,token_hash,expires_at)
               values (%s,%s,%s,%s)""",
            (UUID(user.id), conversation_id, _hash_ticket(ticket), expires_at),
        )
    return {"ticket": ticket}


@router.websocket("/ws/conversations/{conversation_id}")
async def conversation_socket(
    websocket: WebSocket,
    conversation_id: UUID,
    ticket: str,
) -> None:
    origin = websocket.headers.get("origin")
    if origin not in get_settings().cors_origins:
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    try:
        with database_connection() as connection:
            ticket_row = connection.execute(
                """update websocket_tickets
                   set used_at=now()
                   where token_hash=%s and conversation_id=%s
                     and used_at is null and expires_at>now()
                   returning user_id""",
                (_hash_ticket(ticket), conversation_id),
            ).fetchone()
        if not ticket_row:
            await websocket.close(code=4401, reason="Invalid or expired ticket")
            return
    except DatabaseError:
        logger.exception("Could not validate a realtime connection ticket")
        await websocket.close(code=1011, reason="Realtime service unavailable")
        return

    user_id = ticket_row["user_id"]
    try:
        with database_connection(str(user_id)) as connection:
            membership = connection.execute(
                """select 1 from conversation_members
                   where conversation_id=%s and student_id=%s""",
                (conversation_id, user_id),
            ).fetchone()
        if not membership:
            await websocket.close(code=4403, reason="Conversation access denied")
            return
    except DatabaseError:
        logger.exception("Could not verify conversation membership")
        await websocket.close(code=1011, reason="Realtime service unavailable")
        return

    await websocket.accept()
    try:
        settings = get_settings()
        if not settings.database_url:
            await websocket.close(code=1011, reason="PostgreSQL is not configured")
            return
        async with await psycopg.AsyncConnection.connect(
            settings.database_url,
            autocommit=True,
        ) as connection:
            await connection.execute("listen study_buddy_messages")
            await websocket.send_json({"event": "ready"})
            while True:
                notified = False
                async for notification in connection.notifies(timeout=20, stop_after=1):
                    notified = True
                    if notification.payload != str(conversation_id):
                        continue
                    membership = await (
                        await connection.execute(
                            """select 1 from conversation_members
                               where conversation_id=%s and student_id=%s""",
                            (conversation_id, user_id),
                        )
                    ).fetchone()
                    if not membership:
                        await websocket.close(code=4403, reason="Conversation access revoked")
                        return
                    await websocket.send_json(
                        {
                            "event": "message",
                            "conversation_id": str(conversation_id),
                        }
                    )
                if not notified:
                    await websocket.send_json({"event": "heartbeat"})
    except WebSocketDisconnect:
        return
    except (psycopg.Error, OSError):
        logger.exception("PostgreSQL realtime connection failed")
        try:
            await websocket.close(code=1011, reason="Realtime service unavailable")
        except RuntimeError:
            return
