import logging
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.auth import CurrentUser
from app.database import DatabaseError
from app.profiles import _database_error
from app.schemas import (
    ConversationView,
    MessageCreate,
    MessageView,
    NotificationView,
    StartConversationRequest,
)

router = APIRouter(prefix="/api/v1", tags=["messages and notifications"])
logger = logging.getLogger(__name__)
BATCH_SIZE = 500


def _chunks(values: list[str], size: int = BATCH_SIZE) -> Iterable[list[str]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def _api_permission_error(error: DatabaseError, operation: str) -> HTTPException:
    if getattr(error, "code", None) == "42501":
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=getattr(error, "message", "You do not have access to this conversation."),
        )
    if getattr(error, "code", None) == "MESSAGE_LIMIT":
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error.message,
        )
    if getattr(error, "code", None) == "P0001":
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error.message,
        )
    if "rate limit exceeded" in getattr(error, "message", "").lower():
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You’re sending messages too quickly. Please try again later.",
        )
    logger.exception("PostgreSQL message operation failed")
    return _database_error(operation)


@router.get("/conversations", response_model=list[ConversationView])
def list_conversations(user: CurrentUser) -> list[ConversationView]:
    try:
        conversations = (
            user.db.table("conversations")
            .select("id, kind, group_id, connection_id, created_at")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
            .data
        )
        if not conversations:
            return []

        conversation_ids = [conversation["id"] for conversation in conversations]
        memberships: list[dict[str, Any]] = []
        for batch in _chunks(conversation_ids):
            memberships.extend(
                user.db.table("conversation_members")
                .select("conversation_id, student_id")
                .in_("conversation_id", batch)
                .execute()
                .data
            )
        member_ids = list({item["student_id"] for item in memberships})
        profiles: dict[str, dict[str, Any]] = {}
        for batch in _chunks(member_ids):
            rows = user.db.table("profiles").select("id, full_name").in_("id", batch).execute().data
            profiles.update({row["id"]: row for row in rows})

        connection_ids = list(
            {
                item["connection_id"]
                for item in conversations
                if item["kind"] == "direct" and item["connection_id"]
            }
        )
        connections: dict[str, dict[str, Any]] = {}
        for batch in _chunks(connection_ids):
            rows = (
                user.db.table("connections")
                .select("id, requester_id, addressee_id, status, intro_messages_sent")
                .in_("id", batch)
                .execute()
                .data
            )
            connections.update({row["id"]: row for row in rows})

        group_ids = list(
            {
                item["group_id"]
                for item in conversations
                if item["kind"] == "group" and item["group_id"]
            }
        )
        groups: dict[str, str] = {}
        for batch in _chunks(group_ids):
            rows = user.db.table("study_groups").select("id, name").in_("id", batch).execute().data
            groups.update({row["id"]: row["name"] for row in rows})

        latest_messages: dict[str, dict[str, Any]] = {}
        message_rows = user.db.rpc("recent_conversation_messages", {}).execute().data
        for message in message_rows:
            latest_messages.setdefault(message["conversation_id"], message)

        unread_counts: dict[str, int] = {}
        for batch in _chunks(conversation_ids):
            notifications = (
                user.db.table("notifications")
                .select("entity_id")
                .eq("kind", "new_message")
                .is_("read_at", "null")
                .in_("entity_id", batch)
                .execute()
                .data
            )
            for notification in notifications:
                conversation_id = notification["entity_id"]
                unread_counts[conversation_id] = unread_counts.get(conversation_id, 0) + 1
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load conversations")
        raise _database_error("load conversations") from error

    members_by_conversation: dict[str, list[str]] = {}
    for membership in memberships:
        if membership["student_id"] != user.id:
            name = profiles.get(membership["student_id"], {}).get("full_name", "Study Buddy member")
            members_by_conversation.setdefault(membership["conversation_id"], []).append(name)

    results = []
    for conversation in conversations:
        group_id = conversation["group_id"]
        names = members_by_conversation.get(conversation["id"], [])
        latest = latest_messages.get(conversation["id"])
        contact = connections.get(conversation["connection_id"])
        communication_status = contact["status"] if contact else None
        request_direction = None
        intro_messages_remaining = None
        if communication_status == "pending" and contact:
            request_direction = (
                "outgoing" if contact["requester_id"] == user.id else "incoming"
            )
            if request_direction == "outgoing":
                intro_messages_remaining = max(
                    0, 3 - int(contact["intro_messages_sent"])
                )
        results.append(
            ConversationView(
                id=conversation["id"],
                kind=conversation["kind"],
                group_id=group_id,
                connection_id=conversation["connection_id"],
                communication_status=communication_status,
                request_direction=request_direction,
                intro_messages_remaining=intro_messages_remaining,
                title=groups.get(group_id, "Study group")
                if conversation["kind"] == "group"
                else (names[0] if names else "Study partner"),
                other_members=names,
                last_message=latest["body"] if latest else None,
                last_message_at=latest["created_at"] if latest else None,
                unread_count=unread_counts.get(conversation["id"], 0),
            )
        )
    return results


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageView],
)
def list_messages(
    conversation_id: UUID,
    user: CurrentUser,
    before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[MessageView]:
    try:
        conversation = (
            user.db.table("conversations")
            .select("id")
            .eq("id", str(conversation_id))
            .maybe_single()
            .execute()
            .data
        )
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or you are not a member.",
            )
        query = (
            user.db.table("messages")
            .select("id, conversation_id, author_id, body, created_at")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .limit(limit)
        )
        if before:
            query = query.lt("created_at", before.isoformat())
        messages = query.execute().data
        author_ids = list({message["author_id"] for message in messages})
        profiles: dict[str, str] = {}
        for batch in _chunks(author_ids):
            rows = user.db.table("profiles").select("id, full_name").in_("id", batch).execute().data
            profiles.update({row["id"]: row["full_name"] for row in rows})
    except DatabaseError as error:
        raise _api_permission_error(error, "load conversation messages") from error

    return [
        MessageView(
            **message,
            author_name=profiles.get(message["author_id"], "Study Buddy member"),
        )
        for message in reversed(messages)
    ]


@router.post(
    "/conversations/{conversation_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_conversation_read(conversation_id: UUID, user: CurrentUser) -> None:
    try:
        user.db.table("notifications").update({"read_at": datetime.now(UTC).isoformat()}).eq(
            "user_id", user.id
        ).eq("kind", "new_message").eq("entity_id", str(conversation_id)).is_(
            "read_at", "null"
        ).execute()
    except DatabaseError as error:
        raise _api_permission_error(error, "mark conversation messages as read") from error


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageView,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: UUID,
    message: MessageCreate,
    user: CurrentUser,
) -> MessageView:
    try:
        result = user.db.rpc(
            "send_conversation_message",
            {
                "p_conversation_id": str(conversation_id),
                "p_body": message.body,
            },
        ).execute().data
    except DatabaseError as error:
        raise _api_permission_error(error, "send the message") from error

    return MessageView(**result)


@router.post(
    "/conversations/start",
    response_model=MessageView,
    status_code=status.HTTP_201_CREATED,
)
def start_conversation(
    request: StartConversationRequest,
    user: CurrentUser,
) -> MessageView:
    try:
        result = user.db.rpc(
            "start_conversation",
            {
                "p_student_id": str(request.student_id),
                "p_body": request.body,
            },
        ).execute().data
    except DatabaseError as error:
        raise _api_permission_error(error, "start a conversation") from error
    return MessageView(**result)


@router.delete(
    "/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_message(message_id: UUID, user: CurrentUser) -> None:
    try:
        result = (
            user.db.table("messages")
            .delete()
            .eq("id", str(message_id))
            .eq("author_id", user.id)
            .select("id")
            .execute()
        )
    except DatabaseError as error:
        raise _api_permission_error(error, "delete the message") from error
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or it is not yours to delete.",
        )


@router.get("/notifications", response_model=list[NotificationView])
def list_notifications(
    user: CurrentUser,
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[NotificationView]:
    try:
        user.db.rpc("ensure_upcoming_session_notifications", {}).execute()
        query = (
            user.db.table("notifications")
            .select("id, kind, title, body, entity_type, entity_id, read_at, created_at")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if unread_only:
            query = query.is_("read_at", "null")
        return query.execute().data
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load notifications")
        raise _database_error("load notifications") from error


@router.get("/notifications/unread-count")
def unread_notification_count(user: CurrentUser) -> dict[str, int]:
    try:
        user.db.rpc("ensure_upcoming_session_notifications", {}).execute()
        result = (
            user.db.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user.id)
            .is_("read_at", "null")
            .limit(0)
            .execute()
        )
    except DatabaseError as error:
        raise _api_permission_error(error, "count unread notifications") from error
    return {"count": result.count or 0}


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(notification_id: UUID, user: CurrentUser) -> None:
    try:
        result = (
            user.db.table("notifications")
            .update({"read_at": datetime.now().astimezone().isoformat()})
            .eq("id", str(notification_id))
            .eq("user_id", user.id)
            .is_("read_at", "null")
            .select("id")
            .execute()
        )
    except DatabaseError as error:
        raise _api_permission_error(error, "update the notification") from error
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or already read.",
        )


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(user: CurrentUser) -> None:
    try:
        user.db.table("notifications").update(
            {"read_at": datetime.now().astimezone().isoformat()}
        ).eq("user_id", user.id).is_("read_at", "null").execute()
    except DatabaseError as error:
        raise _api_permission_error(error, "mark notifications as read") from error
