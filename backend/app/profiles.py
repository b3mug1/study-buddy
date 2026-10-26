import logging
from collections.abc import Sequence
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.database import DatabaseError
from app.schemas import DashboardResponse, ProfileResponse, ProfileUpsert

router = APIRouter(prefix="/api/v1", tags=["students"])
logger = logging.getLogger(__name__)

STUDY_HOURS: dict[str, tuple[str, str]] = {
    "morning": ("08:00", "12:00"),
    "afternoon": ("12:00", "17:00"),
    "evening": ("17:00", "22:00"),
}


def _database_error(operation: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Unable to {operation} right now. Please try again.",
    )


def _load_profile(user: CurrentUser) -> ProfileResponse:
    client = user.db

    try:
        profile_result = (
            client.table("profiles")
            .select(
                "full_name, university_name, major, year_of_study, bio, "
                "is_onboarded, show_in_discovery"
            )
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
        profile = profile_result.data
        if not profile or not profile["is_onboarded"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Complete your student profile to continue.",
            )

        subject_links = (
            client.table("student_subjects")
            .select("subject_id")
            .eq("student_id", user.id)
            .execute()
            .data
        )
        subject_ids = [link["subject_id"] for link in subject_links]
        subjects: Sequence[dict[str, Any]] = []
        if subject_ids:
            subjects = client.table("subjects").select("name").in_("id", subject_ids).execute().data

        availability = (
            client.table("student_availability")
            .select("weekday")
            .eq("student_id", user.id)
            .order("weekday")
            .execute()
            .data
        )
        preference_result = (
            client.table("study_preferences")
            .select("learning_goals, study_format, group_size, language, preferred_hours")
            .eq("student_id", user.id)
            .maybe_single()
            .execute()
        )
        preference = preference_result.data
        if not preference:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Complete your study preferences to continue.",
            )
    except HTTPException:
        raise
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to load a student profile")
        raise _database_error("load your profile") from error

    return ProfileResponse(
        full_name=profile["full_name"],
        university_name=profile["university_name"],
        major=profile["major"],
        year_of_study=profile["year_of_study"],
        bio=profile["bio"],
        subjects=[subject["name"] for subject in subjects],
        learning_goals=preference["learning_goals"],
        availability_days=[row["weekday"] for row in availability],
        preferred_hours=preference["preferred_hours"],
        study_format=preference["study_format"],
        group_size=preference["group_size"],
        language=preference["language"],
        show_in_discovery=profile["show_in_discovery"],
    )


@router.get("/profile", response_model=ProfileResponse)
def get_profile(user: CurrentUser) -> ProfileResponse:
    return _load_profile(user)


@router.put("/profile", status_code=status.HTTP_204_NO_CONTENT)
def save_profile(profile: ProfileUpsert, user: CurrentUser) -> None:
    start_time, end_time = STUDY_HOURS[profile.preferred_hours]
    params = {
        "p_full_name": profile.full_name,
        "p_university_name": profile.university_name,
        "p_major": profile.major,
        "p_year_of_study": profile.year_of_study,
        "p_bio": profile.bio,
        "p_subjects": profile.subjects,
        "p_learning_goals": profile.learning_goals,
        "p_availability_days": profile.availability_days,
        "p_start_time": start_time,
        "p_end_time": end_time,
        "p_study_format": profile.study_format,
        "p_group_size": profile.group_size,
        "p_language": profile.language,
        "p_preferred_hours": profile.preferred_hours,
        "p_show_in_discovery": profile.show_in_discovery,
    }

    try:
        user.db.rpc("complete_onboarding", params).execute()
    except DatabaseError as error:
        logger.exception("PostgreSQL failed to save a student profile")
        raise _database_error("save your profile") from error


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(user: CurrentUser) -> DashboardResponse:
    profile = _load_profile(user)
    items = (
        profile.full_name,
        profile.university_name,
        profile.major,
        profile.bio,
        bool(profile.subjects),
        bool(profile.learning_goals),
    )
    completion = round(sum(bool(item) for item in items) / len(items) * 100)

    from app.discovery import discover_students
    from app.groups import list_groups
    from app.messaging import list_conversations, unread_notification_count
    from app.schemas import (
        DashboardConversationCard,
        DashboardGroupCard,
        DashboardMatchCard,
        DashboardSessionCard,
    )
    from app.sessions import list_sessions

    groups = list_groups(user, search=None, subject=None)
    sessions = list_sessions(
        user,
        upcoming_only=True,
        include_cancelled=False,
        limit=5,
    )
    conversations = list_conversations(user)
    unread_count = unread_notification_count(user)["count"]
    recommendations = discover_students(
        user,
        search=None,
        subject=None,
        university=None,
        weekday=None,
        study_format=None,
        page=1,
        page_size=3,
    )

    return DashboardResponse(
        profile=profile,
        profile_completion=completion,
        recommended_students=[
            DashboardMatchCard(
                id=student.id,
                full_name=student.full_name,
                major=student.major,
                compatibility=student.compatibility,
                shared_subjects=student.shared_subjects,
            )
            for student in recommendations.items
        ],
        upcoming_sessions=[
            DashboardSessionCard(
                id=session.id,
                subject=session.subject,
                topic=session.topic,
                starts_at=session.starts_at,
                study_format=session.study_format,
            )
            for session in sessions[:5]
        ],
        study_groups=[
            DashboardGroupCard(
                id=group.id,
                name=group.name,
                subject=group.subject,
                visibility=group.visibility,
                member_count=group.member_count,
            )
            for group in groups
            if group.is_member
        ][:5],
        recent_conversations=[
            DashboardConversationCard(
                id=conversation.id,
                title=conversation.title,
                last_message=conversation.last_message,
                unread_count=conversation.unread_count,
            )
            for conversation in conversations[:5]
        ],
        unread_notifications=unread_count,
    )
