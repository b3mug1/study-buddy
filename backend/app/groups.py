import logging
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.auth import CurrentUser
from app.database import DatabaseError
from app.profiles import _database_error
from app.schemas import (
    JoinRequestDecision,
    StudyGroupCreate,
    StudyGroupUpdate,
    StudyGroupView,
)

router = APIRouter(prefix="/api/v1/groups", tags=["study groups"])
logger = logging.getLogger(__name__)
BATCH_SIZE = 500


def _chunks(values: list[str], size: int = BATCH_SIZE) -> Iterable[list[str]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def _profiles_by_id(user: CurrentUser, student_ids: list[str]) -> dict[str, dict[str, Any]]:
    profiles: dict[str, dict[str, Any]] = {}
    for batch in _chunks(list(set(student_ids))):
        rows = (
            user.db.table("profiles").select("id, full_name, major").in_("id", batch).execute().data
        )
        profiles.update({row["id"]: row for row in rows})
    return profiles


def _group_views(
    user: CurrentUser,
    groups: list[dict[str, Any]],
    *,
    include_details: bool = False,
) -> list[StudyGroupView]:
    if not groups:
        return []

    group_ids = [group["id"] for group in groups]
    memberships: list[dict[str, Any]] = []
    own_memberships: list[dict[str, Any]] = []
    own_requests: list[dict[str, Any]] = []
    pending_requests: list[dict[str, Any]] = []
    for group_batch in _chunks(group_ids):
        memberships.extend(
            user.db.table("group_members")
            .select("group_id, student_id, role, joined_at")
            .in_("group_id", group_batch)
            .execute()
            .data
        )
        own_memberships.extend(
            user.db.table("group_members")
            .select("group_id")
            .eq("student_id", user.id)
            .in_("group_id", group_batch)
            .execute()
            .data
        )
        own_requests.extend(
            user.db.table("group_join_requests")
            .select("group_id, status")
            .eq("student_id", user.id)
            .in_("group_id", group_batch)
            .execute()
            .data
        )
        if include_details:
            pending_requests.extend(
                user.db.table("group_join_requests")
                .select("id, group_id, student_id, status, created_at")
                .eq("status", "pending")
                .in_("group_id", group_batch)
                .execute()
                .data
            )

    student_ids = (
        [group["owner_id"] for group in groups]
        + [member["student_id"] for member in memberships]
        + [request["student_id"] for request in pending_requests]
    )
    profiles = _profiles_by_id(user, student_ids)
    members_by_group: dict[str, list[dict[str, Any]]] = {}
    for member in memberships:
        members_by_group.setdefault(member["group_id"], []).append(member)
    requests_by_group: dict[str, list[dict[str, Any]]] = {}
    for request in pending_requests:
        requests_by_group.setdefault(request["group_id"], []).append(request)
    own_group_ids = {item["group_id"] for item in own_memberships}
    requests_by_status = {item["group_id"]: item["status"] for item in own_requests}
    results = []

    for group in groups:
        group_members = members_by_group.get(group["id"], [])
        owner_profile = profiles.get(group["owner_id"], {})
        members = [
            {
                "student_id": member["student_id"],
                "full_name": profiles.get(member["student_id"], {}).get(
                    "full_name", "Study Buddy member"
                ),
                "major": profiles.get(member["student_id"], {}).get("major", ""),
                "role": member["role"],
                "joined_at": member["joined_at"],
            }
            for member in group_members
        ]
        join_requests = [
            {
                "id": request["id"],
                "student_id": request["student_id"],
                "full_name": profiles.get(request["student_id"], {}).get(
                    "full_name", "Study Buddy student"
                ),
                "major": profiles.get(request["student_id"], {}).get("major", ""),
                "status": request["status"],
                "created_at": request["created_at"],
            }
            for request in requests_by_group.get(group["id"], [])
        ]
        results.append(
            StudyGroupView(
                **group,
                current_user_id=user.id,
                owner_name=owner_profile.get("full_name", "Study Buddy student"),
                member_count=len(group_members),
                is_member=group["id"] in own_group_ids,
                join_status=requests_by_status.get(group["id"]),
                members=members if include_details else [],
                join_requests=join_requests if include_details else [],
            )
        )
    return results


def _group_rpc_error(error: DatabaseError, fallback: str) -> HTTPException:
    logger.exception("PostgreSQL study group operation failed")
    message = getattr(error, "message", "")
    if "rate limit exceeded" in message.lower():
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You’re doing that too often. Please try again later.",
        )
    known_conflicts = (
        "already a member",
        "already pending",
        "group is full",
        "request not found",
        "only the group owner",
        "cannot leave or be removed",
        "member not found",
        "study group not found",
    )
    if any(detail in message.lower() for detail in known_conflicts):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    return _database_error(fallback)


@router.get("", response_model=list[StudyGroupView])
def list_groups(
    user: CurrentUser,
    search: str | None = Query(default=None, max_length=100),
    subject: str | None = Query(default=None, max_length=80),
) -> list[StudyGroupView]:
    try:
        query = (
            user.db.table("study_groups")
            .select("id, owner_id, name, description, subject, visibility, max_members, created_at")
            .order("created_at", desc=True)
            .limit(200)
        )
        if search:
            query = query.ilike("name", f"%{search.strip()}%")
        if subject:
            query = query.ilike("subject", f"%{subject.strip()}%")
        groups = query.execute().data
        return _group_views(user, groups)
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to list study groups")
        raise _database_error("load study groups") from error


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group(
    group: StudyGroupCreate,
    user: CurrentUser,
) -> dict[str, str]:
    try:
        result = user.db.rpc(
            "create_study_group",
            {
                "p_name": group.name,
                "p_description": group.description,
                "p_subject": group.subject,
                "p_visibility": group.visibility,
                "p_max_members": group.max_members,
            },
        ).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to create a study group")
        if "rate limit exceeded" in getattr(error, "message", "").lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You’re creating groups too quickly. Please try again later.",
            ) from error
        raise _database_error("create the study group") from error
    return {"id": str(result.data)}


@router.get("/{group_id}", response_model=StudyGroupView)
def get_group(group_id: UUID, user: CurrentUser) -> StudyGroupView:
    try:
        group = (
            user.db.table("study_groups")
            .select("id, owner_id, name, description, subject, visibility, max_members, created_at")
            .eq("id", str(group_id))
            .maybe_single()
            .execute()
            .data
        )
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study group not found.",
            )
        return _group_views(user, [group], include_details=True)[0]
    except HTTPException:
        raise
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load a study group")
        raise _database_error("load the study group") from error


@router.patch("/{group_id}")
def update_group(
    group_id: UUID,
    changes: StudyGroupUpdate,
    user: CurrentUser,
) -> dict[str, str]:
    values = changes.model_dump(exclude_unset=True, exclude_none=True)
    if not values:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one group setting to update.",
        )
    try:
        result = (
            user.db.table("study_groups")
            .update(values)
            .eq("id", str(group_id))
            .eq("owner_id", user.id)
            .select("id")
            .execute()
        )
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to update a study group")
        if "maximum members cannot be lower" in getattr(error, "message", "").lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The maximum size cannot be lower than the current membership.",
            ) from error
        raise _database_error("update the study group") from error
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found or you are not its owner.",
        )
    return {"status": "updated"}


@router.post("/{group_id}/join")
def request_to_join_group(group_id: UUID, user: CurrentUser) -> dict[str, str]:
    try:
        result = user.db.rpc(
            "request_group_join",
            {"p_group_id": str(group_id)},
        ).execute()
    except DatabaseError as error:
        raise _group_rpc_error(error, "join the study group") from error
    return {"status": result.data}


@router.post("/requests/{request_id}/respond", status_code=status.HTTP_204_NO_CONTENT)
def respond_to_join_request(
    request_id: UUID,
    decision: JoinRequestDecision,
    user: CurrentUser,
) -> None:
    try:
        user.db.rpc(
            "respond_to_group_join_request",
            {
                "p_request_id": str(request_id),
                "p_approve": decision.approve,
            },
        ).execute()
    except DatabaseError as error:
        raise _group_rpc_error(error, "respond to the join request") from error


@router.delete(
    "/{group_id}/members/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_group_member(
    group_id: UUID,
    student_id: UUID,
    user: CurrentUser,
) -> None:
    try:
        user.db.rpc(
            "remove_group_member",
            {
                "p_group_id": str(group_id),
                "p_student_id": str(student_id),
            },
        ).execute()
    except DatabaseError as error:
        raise _group_rpc_error(error, "update group membership") from error
