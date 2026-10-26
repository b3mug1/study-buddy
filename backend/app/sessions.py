import logging
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.auth import CurrentUser
from app.database import DatabaseError, database_connection
from app.profiles import _database_error
from app.schemas import (
    SessionInvitationDecision,
    SessionOutcomeUpdate,
    StudySessionCreate,
    StudySessionView,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["study sessions"])
logger = logging.getLogger(__name__)
BATCH_SIZE = 500


def _chunks(values: list[str], size: int = BATCH_SIZE) -> Iterable[list[str]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def _session_views(
    user: CurrentUser,
    sessions: list[dict[str, Any]],
) -> list[StudySessionView]:
    if not sessions:
        return []
    session_ids = [session["id"] for session in sessions]
    participants: list[dict[str, Any]] = []
    for batch in _chunks(session_ids):
        participants.extend(
            user.db.table("session_participants")
            .select("session_id, student_id, status")
            .in_("session_id", batch)
            .execute()
            .data
        )

    profile_ids = list(
        {session["owner_id"] for session in sessions}
        | {participant["student_id"] for participant in participants}
    )
    profiles: dict[str, str] = {}
    for batch in _chunks(profile_ids):
        rows = user.db.table("profiles").select("id, full_name").in_("id", batch).execute().data
        profiles.update({row["id"]: row["full_name"] for row in rows})

    participants_by_session: dict[str, list[dict[str, Any]]] = {}
    for participant in participants:
        participants_by_session.setdefault(participant["session_id"], []).append(
            {
                "student_id": participant["student_id"],
                "full_name": profiles.get(participant["student_id"], "Study Buddy student"),
                "status": participant["status"],
            }
        )

    return [
        StudySessionView(
            **session,
            current_user_id=user.id,
            owner_name=profiles.get(session["owner_id"], "Study Buddy student"),
            participants=participants_by_session.get(session["id"], []),
        )
        for session in sessions
    ]


@router.get("", response_model=list[StudySessionView])
def list_sessions(
    user: CurrentUser,
    upcoming_only: bool = True,
    include_cancelled: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[StudySessionView]:
    try:
        query = (
            user.db.table("study_sessions")
            .select(
                "id, owner_id, subject, topic, starts_at, duration_minutes, "
                "study_format, meeting_details, max_participants, status, summary, next_steps"
            )
            .order("starts_at")
            .limit(limit)
        )
        if upcoming_only:
            query = query.gte("starts_at", (datetime.now(UTC) - timedelta(days=7)).isoformat())
        if not include_cancelled:
            query = query.eq("status", "scheduled")
        return _session_views(user, query.execute().data)
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to list study sessions")
        raise _database_error("load study sessions") from error


@router.get("/history", response_model=list[StudySessionView])
def list_completed_sessions(
    user: CurrentUser,
    limit: int = Query(default=30, ge=1, le=100),
) -> list[StudySessionView]:
    try:
        query = (
            user.db.table("study_sessions")
            .select(
                "id, owner_id, subject, topic, starts_at, duration_minutes, "
                "study_format, meeting_details, max_participants, status, summary, next_steps"
            )
            .eq("status", "completed")
            .lte("starts_at", datetime.now(UTC).isoformat())
            .order("starts_at", desc=True)
            .limit(limit)
        )
        return _session_views(user, query.execute().data)
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to list completed study sessions")
        raise _database_error("load completed study sessions") from error


@router.post("", status_code=status.HTTP_201_CREATED)
def create_session(
    session: StudySessionCreate,
    user: CurrentUser,
) -> dict[str, str]:
    try:
        result = user.db.rpc(
            "create_study_session",
            {
                "p_subject": session.subject,
                "p_topic": session.topic,
                "p_starts_at": session.starts_at.isoformat(),
                "p_duration_minutes": session.duration_minutes,
                "p_study_format": session.study_format,
                "p_meeting_details": session.meeting_details,
                "p_max_participants": session.max_participants,
                "p_invited_user_ids": [str(student_id) for student_id in session.invited_user_ids],
            },
        ).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to create a study session")
        message = getattr(error, "message", "")
        if "rate limit exceeded" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You’re scheduling sessions too quickly. Please try again later.",
            ) from error
        if any(
            detail in message.lower()
            for detail in ("invitees must be connected", "session details are invalid")
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=message,
            ) from error
        raise _database_error("create the study session") from error
    return {"id": str(result.data)}


@router.post(
    "/{session_id}/invitation",
    status_code=status.HTTP_204_NO_CONTENT,
)
def respond_to_invitation(
    session_id: UUID,
    decision: SessionInvitationDecision,
    user: CurrentUser,
) -> None:
    try:
        user.db.rpc(
            "respond_to_session_invitation",
            {
                "p_session_id": str(session_id),
                "p_accept": decision.accept,
            },
        ).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to respond to a session invitation")
        message = getattr(error, "message", "")
        if any(
            detail in message.lower()
            for detail in (
                "invitation not found",
                "session is full",
                "session not found",
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            ) from error
        raise _database_error("respond to the study session invitation") from error


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_session(session_id: UUID, user: CurrentUser) -> None:
    try:
        result = (
            user.db.table("study_sessions")
            .update({"status": "cancelled"})
            .eq("id", str(session_id))
            .eq("owner_id", user.id)
            .eq("status", "scheduled")
            .select("id")
            .execute()
        )
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to cancel a study session")
        raise _database_error("cancel the study session") from error
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found or you are not its organizer.",
        )


@router.post("/{session_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def complete_session(session_id: UUID, user: CurrentUser) -> None:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            session = connection.execute(
                "select owner_id,subject,topic,starts_at,status "
                "from study_sessions where id=%s for update",
                (session_id,),
            ).fetchone()
            if not session or session["owner_id"] != user_id:
                raise HTTPException(
                    status_code=404, detail="Study session not found or you are not its organizer."
                )
            if session["status"] != "scheduled":
                raise HTTPException(
                    status_code=409, detail="This study session is no longer scheduled."
                )
            if session["starts_at"] > datetime.now(UTC):
                raise HTTPException(
                    status_code=409, detail="A session can be completed after it starts."
                )
            connection.execute(
                "update study_sessions set status='completed',updated_at=now() where id=%s",
                (session_id,),
            )
            participants = connection.execute(
                """select student_id from session_participants
                   where session_id=%s and status='accepted' and student_id<>%s""",
                (session_id, user_id),
            ).fetchall()
            for participant in participants:
                connection.execute(
                    """insert into notifications(user_id,kind,title,body,entity_type,entity_id)
                       values (%s,'session_completed','Study session completed',%s,
                         'study_session',%s)""",
                    (
                        participant["student_id"],
                        f"{session['subject']}: {session['topic']} has been marked complete.",
                        session_id,
                    ),
                )
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to complete a study session")
        raise _database_error("complete the study session") from error


@router.put("/{session_id}/outcome")
def save_session_outcome(
    session_id: UUID,
    outcome: SessionOutcomeUpdate,
    user: CurrentUser,
) -> dict[str, str]:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            participant = connection.execute(
                """select 1 from session_participants
                   where session_id=%s and student_id=%s and status='accepted'""",
                (session_id, user_id),
            ).fetchone()
            if not participant:
                raise HTTPException(
                    status_code=404, detail="Study session not found or you are not a participant."
                )
            row = connection.execute(
                """update study_sessions set summary=%s,next_steps=%s,updated_at=now()
                   where id=%s and status<>'cancelled'
                   returning id,owner_id,subject,topic""",
                (outcome.summary, outcome.next_steps, session_id),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Study session not found.")
            participants = connection.execute(
                """select student_id from session_participants
                   where session_id=%s and status='accepted' and student_id<>%s""",
                (session_id, user_id),
            ).fetchall()
            for participant_row in participants:
                connection.execute(
                    """insert into notifications(user_id,kind,title,body,entity_type,entity_id)
                       values (%s,'session_outcome','Session notes updated',%s,
                         'study_session',%s)""",
                    (
                        participant_row["student_id"],
                        f"Notes updated for {row['subject']}: {row['topic']}.",
                        session_id,
                    ),
                )
        return {"summary": outcome.summary, "next_steps": outcome.next_steps}
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to save study session notes")
        raise _database_error("save the study session notes") from error
