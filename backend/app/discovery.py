import logging
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.auth import CurrentUser
from app.database import DatabaseError
from app.matching import score_compatibility
from app.profiles import _database_error
from app.schemas import (
    ConnectionDecision,
    ConnectionRequest,
    ConnectionView,
    DiscoverableStudent,
    DiscoveryPage,
)

router = APIRouter(prefix="/api/v1", tags=["discovery"])
logger = logging.getLogger(__name__)
FETCH_BATCH_SIZE = 500


def _chunks(values: list[str], size: int = FETCH_BATCH_SIZE) -> Iterable[list[str]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def _fetch_all(query: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        batch = query.range(offset, offset + FETCH_BATCH_SIZE - 1).execute().data
        rows.extend(batch)
        if len(batch) < FETCH_BATCH_SIZE:
            return rows
        offset += FETCH_BATCH_SIZE


def _load_candidate_data(
    user: CurrentUser,
    student_ids: list[str],
) -> dict[str, dict[str, Any]]:
    client = user.db
    data = {
        student_id: {
            "subjects": [],
            "learning_goals": [],
            "availability": [],
            "study_format": "hybrid",
            "language": "",
            "preferred_hours": "afternoon",
        }
        for student_id in student_ids
    }
    if not student_ids:
        return data

    try:
        for student_batch in _chunks(student_ids):
            links = (
                client.table("student_subjects")
                .select("student_id, subject_id")
                .in_("student_id", student_batch)
                .execute()
                .data
            )
            subjects_by_id: dict[str, str] = {}
            subject_ids = list({link["subject_id"] for link in links})
            for subject_batch in _chunks(subject_ids):
                subjects = (
                    client.table("subjects")
                    .select("id, name")
                    .in_("id", subject_batch)
                    .execute()
                    .data
                )
                subjects_by_id.update({subject["id"]: subject["name"] for subject in subjects})
            for link in links:
                data[link["student_id"]]["subjects"].append(subjects_by_id[link["subject_id"]])

            preferences = (
                client.table("study_preferences")
                .select("student_id, learning_goals, study_format, language, preferred_hours")
                .in_("student_id", student_batch)
                .execute()
                .data
            )
            for preference in preferences:
                data[preference["student_id"]].update(
                    {
                        "learning_goals": preference["learning_goals"],
                        "study_format": preference["study_format"],
                        "language": preference["language"],
                        "preferred_hours": preference["preferred_hours"],
                    }
                )

            availability = (
                client.table("student_availability")
                .select("student_id, weekday, start_time, end_time")
                .in_("student_id", student_batch)
                .execute()
                .data
            )
            for slot in availability:
                data[slot["student_id"]]["availability"].append(
                    {
                        "weekday": slot["weekday"],
                        "start_time": slot["start_time"],
                        "end_time": slot["end_time"],
                    }
                )
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load student discovery data")
        raise _database_error("load student recommendations") from error

    return data


def _load_connection_states(
    user: CurrentUser,
) -> dict[str, tuple[str, str]]:
    try:
        requested = (
            user.db.table("connections")
            .select("id, requester_id, addressee_id, status")
            .eq("requester_id", user.id)
            .execute()
            .data
        )
        received = (
            user.db.table("connections")
            .select("id, requester_id, addressee_id, status")
            .eq("addressee_id", user.id)
            .execute()
            .data
        )
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load connection state")
        raise _database_error("load connection status") from error

    state: dict[str, tuple[str, str]] = {}
    for connection in requested:
        state[connection["addressee_id"]] = (connection["status"], "outgoing")
    for connection in received:
        state[connection["requester_id"]] = (connection["status"], "incoming")
    return state


@router.get("/discover", response_model=DiscoveryPage)
def discover_students(
    user: CurrentUser,
    search: str | None = Query(default=None, max_length=100),
    subject: str | None = Query(default=None, max_length=80),
    university: str | None = Query(default=None, max_length=120),
    weekday: int | None = Query(default=None, ge=0, le=6),
    study_format: str | None = Query(default=None, pattern="^(online|offline|hybrid)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> DiscoveryPage:
    try:
        own_profile = (
            user.db.table("profiles")
            .select("id, full_name, university_name, major, year_of_study")
            .eq("id", user.id)
            .maybe_single()
            .execute()
            .data
        )
        if not own_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Complete your student profile to discover study partners.",
            )

        query = (
            user.db.table("profiles")
            .select("id, full_name, university_name, major, year_of_study, bio")
            .eq("is_onboarded", True)
            .eq("show_in_discovery", True)
            .neq("id", user.id)
            .order("full_name")
        )
        if search:
            query = query.ilike("full_name", f"%{search.strip()}%")
        if university:
            query = query.ilike("university_name", f"%{university.strip()}%")
        students = _fetch_all(query)
        student_ids = [student["id"] for student in students]

        own_data = _load_candidate_data(user, [user.id])[user.id]
        candidate_data = _load_candidate_data(user, student_ids)
        connection_states = _load_connection_states(user)
    except HTTPException:
        raise
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load discovery profiles")
        raise _database_error("search student profiles") from error

    current = own_data
    current["availability"] = own_data["availability"]
    scored: list[DiscoverableStudent] = []
    for student in students:
        candidate = candidate_data[student["id"]]
        if subject and subject.casefold() not in {
            item.casefold() for item in candidate["subjects"]
        }:
            continue
        if weekday is not None and weekday not in {
            int(item["weekday"]) for item in candidate["availability"]
        }:
            continue
        if study_format and candidate["study_format"] != study_format:
            continue

        compatibility = score_compatibility(current, candidate)
        state = connection_states.get(student["id"])
        scored.append(
            DiscoverableStudent(
                **student,
                subjects=candidate["subjects"],
                study_format=candidate["study_format"],
                preferred_hours=candidate["preferred_hours"],
                availability_days=sorted(
                    {int(item["weekday"]) for item in candidate["availability"]}
                ),
                compatibility=compatibility.score,
                shared_subjects=compatibility.shared_subjects,
                explanation=compatibility.explanation,
                breakdown=compatibility.breakdown,
                connection_status=state[0] if state else None,
                connection_direction=state[1] if state else None,
            )
        )

    scored.sort(key=lambda student: (-student.compatibility, student.full_name.casefold()))
    offset = (page - 1) * page_size
    page_items = scored[offset : offset + page_size]
    return DiscoveryPage(
        items=page_items,
        page=page,
        page_size=page_size,
        total=len(scored),
        has_more=offset + page_size < len(scored),
    )


@router.post("/connections", status_code=status.HTTP_201_CREATED)
def send_connection_request(
    request: ConnectionRequest,
    user: CurrentUser,
) -> dict[str, str]:
    try:
        result = user.db.rpc(
            "create_connection_request",
            {"p_addressee_id": str(request.student_id)},
        ).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to create a connection request")
        message = getattr(error, "message", "")
        if "rate limit exceeded" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You’re sending requests too quickly. Please try again later.",
            ) from error
        if any(
            text in message.lower()
            for text in (
                "already connected",
                "already pending",
                "not available for discovery",
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            ) from error
        raise _database_error("send a connection request") from error
    return {"id": str(result.data), "status": "pending"}


@router.get("/students/{student_id}", response_model=DiscoverableStudent)
def get_student_profile(student_id: UUID, user: CurrentUser) -> DiscoverableStudent:
    try:
        student = (
            user.db.table("profiles")
            .select("id, full_name, university_name, major, year_of_study, bio")
            .eq("id", str(student_id))
            .maybe_single()
            .execute()
            .data
        )
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found or not available to you.",
            )
        own_profile = (
            user.db.table("profiles").select("id").eq("id", user.id).maybe_single().execute().data
        )
        if not own_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Complete your student profile to continue.",
            )
        own_data = _load_candidate_data(user, [user.id])[user.id]
        candidate = _load_candidate_data(user, [str(student_id)])[str(student_id)]
        state = _load_connection_states(user).get(str(student_id))
    except HTTPException:
        raise
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load a student profile")
        raise _database_error("load the student profile") from error

    compatibility = score_compatibility(own_data, candidate)
    return DiscoverableStudent(
        **student,
        subjects=candidate["subjects"],
        study_format=candidate["study_format"],
        preferred_hours=candidate["preferred_hours"],
        availability_days=sorted({int(item["weekday"]) for item in candidate["availability"]}),
        compatibility=compatibility.score,
        shared_subjects=compatibility.shared_subjects,
        explanation=compatibility.explanation,
        breakdown=compatibility.breakdown,
        connection_status=state[0] if state else None,
        connection_direction=state[1] if state else None,
    )


@router.get("/connections", response_model=list[ConnectionView])
def list_connections(user: CurrentUser) -> list[ConnectionView]:
    try:
        outgoing = (
            user.db.table("connections")
            .select("id, requester_id, addressee_id, status, created_at")
            .eq("requester_id", user.id)
            .order("created_at", desc=True)
            .execute()
            .data
        )
        incoming = (
            user.db.table("connections")
            .select("id, requester_id, addressee_id, status, created_at")
            .eq("addressee_id", user.id)
            .order("created_at", desc=True)
            .execute()
            .data
        )
        records = [(item, "outgoing") for item in outgoing] + [
            (item, "incoming") for item in incoming
        ]
        other_ids = list(
            {
                item["addressee_id"] if direction == "outgoing" else item["requester_id"]
                for item, direction in records
            }
        )
        profiles: dict[str, dict[str, Any]] = {}
        for batch in _chunks(other_ids):
            items = (
                user.db.table("profiles")
                .select("id, full_name, university_name, major")
                .in_("id", batch)
                .execute()
                .data
            )
            profiles.update({item["id"]: item for item in items})
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load connections")
        raise _database_error("load connections") from error

    results = []
    for item, direction in records:
        student_id = item["addressee_id"] if direction == "outgoing" else item["requester_id"]
        profile = profiles.get(student_id)
        if profile:
            results.append(
                ConnectionView(
                    id=item["id"],
                    student_id=student_id,
                    full_name=profile["full_name"],
                    university_name=profile["university_name"],
                    major=profile["major"],
                    status=item["status"],
                    direction=direction,
                    created_at=item["created_at"],
                )
            )
    return results


@router.post("/connections/{connection_id}/respond", status_code=status.HTTP_204_NO_CONTENT)
def respond_to_connection(
    connection_id: str,
    decision: ConnectionDecision,
    user: CurrentUser,
) -> None:
    try:
        user.db.rpc(
            "respond_to_connection",
            {"p_connection_id": connection_id, "p_accept": decision.accept},
        ).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to respond to a connection request")
        if getattr(error, "code", None) == "42501":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the recipient can respond to this connection request.",
            ) from error
        message = getattr(error, "message", "").lower()
        if any(detail in message for detail in ("request not found", "already answered")):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This connection request is no longer available.",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to respond to the connection request right now.",
        ) from error
