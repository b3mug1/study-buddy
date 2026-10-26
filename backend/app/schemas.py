from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

SubjectName = Annotated[str, Field(min_length=1, max_length=80)]
LearningGoal = Annotated[str, Field(min_length=1, max_length=100)]
Weekday = Annotated[int, Field(ge=0, le=6)]
TimeOfDay = Literal["morning", "afternoon", "evening"]
StudyFormat = Literal["online", "offline", "hybrid"]
GroupVisibility = Literal["public", "private"]
ConnectionStatus = Literal["pending", "accepted", "declined"]
SessionStatus = Literal["scheduled", "cancelled"]
InvitationStatus = Literal["invited", "accepted", "declined"]


class ProfileUpsert(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: Annotated[str, Field(min_length=2, max_length=80)]
    university_name: Annotated[str, Field(min_length=2, max_length=120)]
    major: Annotated[str, Field(min_length=2, max_length=120)]
    year_of_study: Annotated[int, Field(ge=1, le=12)]
    bio: Annotated[str, Field(max_length=300)] = ""
    subjects: Annotated[list[SubjectName], Field(min_length=1, max_length=12)]
    learning_goals: Annotated[list[LearningGoal], Field(min_length=1, max_length=12)]
    availability_days: Annotated[list[Weekday], Field(min_length=1, max_length=7)]
    preferred_hours: TimeOfDay
    study_format: StudyFormat
    group_size: Annotated[int, Field(ge=2, le=12)]
    language: Annotated[str, Field(min_length=2, max_length=40)]
    show_in_discovery: bool = True

    @field_validator("subjects", "learning_goals")
    @classmethod
    def remove_duplicate_values(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values))

    @field_validator("availability_days")
    @classmethod
    def reject_duplicate_days(cls, days: list[int]) -> list[int]:
        if len(set(days)) != len(days):
            raise ValueError("Availability days must be unique.")
        return days


class ProfileResponse(BaseModel):
    full_name: str
    university_name: str
    major: str
    year_of_study: int
    bio: str
    subjects: list[str]
    learning_goals: list[str]
    availability_days: list[int]
    preferred_hours: TimeOfDay
    study_format: StudyFormat
    group_size: int
    language: str
    show_in_discovery: bool


class DashboardSessionCard(BaseModel):
    id: str
    subject: str
    topic: str
    starts_at: datetime
    study_format: StudyFormat


class DashboardMatchCard(BaseModel):
    id: str
    full_name: str
    major: str
    compatibility: int
    shared_subjects: list[str]


class DashboardGroupCard(BaseModel):
    id: str
    name: str
    subject: str
    visibility: GroupVisibility
    member_count: int


class DashboardConversationCard(BaseModel):
    id: str
    title: str
    last_message: str | None
    unread_count: int


class DashboardResponse(BaseModel):
    profile: ProfileResponse
    profile_completion: int
    recommended_students: list[DashboardMatchCard] = Field(default_factory=list)
    upcoming_sessions: list[DashboardSessionCard] = Field(default_factory=list)
    study_groups: list[DashboardGroupCard] = Field(default_factory=list)
    recent_conversations: list[DashboardConversationCard] = Field(default_factory=list)
    unread_notifications: int = 0


class MatchBreakdown(BaseModel):
    subjects: int
    availability: int
    learning_goals: int
    study_format: int
    language: int


class DiscoverableStudent(BaseModel):
    id: str
    full_name: str
    university_name: str
    major: str
    year_of_study: int
    bio: str
    subjects: list[str]
    study_format: StudyFormat
    preferred_hours: TimeOfDay
    availability_days: list[int]
    compatibility: int
    shared_subjects: list[str]
    explanation: list[str]
    breakdown: MatchBreakdown
    connection_status: ConnectionStatus | None = None
    connection_direction: Literal["incoming", "outgoing"] | None = None


class DiscoveryPage(BaseModel):
    items: list[DiscoverableStudent]
    page: int
    page_size: int
    total: int
    has_more: bool


class ConnectionView(BaseModel):
    id: str
    student_id: str
    full_name: str
    university_name: str
    major: str
    status: ConnectionStatus
    direction: Literal["incoming", "outgoing"]
    created_at: datetime


class ConnectionRequest(BaseModel):
    student_id: UUID


class ConnectionDecision(BaseModel):
    accept: bool


class StudyGroupCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: Annotated[str, Field(min_length=3, max_length=100)]
    description: Annotated[str, Field(max_length=1000)] = ""
    subject: Annotated[str, Field(min_length=1, max_length=80)]
    visibility: GroupVisibility = "public"
    max_members: Annotated[int, Field(ge=2, le=50)] = 8


class StudyGroupUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: Annotated[str, Field(min_length=3, max_length=100)] | None = None
    description: Annotated[str, Field(max_length=1000)] | None = None
    subject: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    visibility: GroupVisibility | None = None
    max_members: Annotated[int, Field(ge=2, le=50)] | None = None


class GroupMemberView(BaseModel):
    student_id: str
    full_name: str
    major: str
    role: Literal["owner", "member"]
    joined_at: datetime


class GroupJoinRequestView(BaseModel):
    id: str
    student_id: str
    full_name: str
    major: str
    status: Literal["pending", "approved", "declined"]
    created_at: datetime


class StudyGroupView(BaseModel):
    id: str
    owner_id: str
    current_user_id: str
    owner_name: str
    name: str
    description: str
    subject: str
    visibility: GroupVisibility
    max_members: int
    member_count: int
    created_at: datetime
    is_member: bool
    join_status: Literal["pending", "approved", "declined"] | None = None
    members: list[GroupMemberView] = Field(default_factory=list)
    join_requests: list[GroupJoinRequestView] = Field(default_factory=list)


class JoinRequestDecision(BaseModel):
    approve: bool


class MessageCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    body: Annotated[str, Field(min_length=1, max_length=4000)]


class MessageView(BaseModel):
    id: str
    conversation_id: str
    author_id: str
    author_name: str
    body: str
    created_at: datetime


class ConversationView(BaseModel):
    id: str
    kind: Literal["direct", "group"]
    group_id: str | None = None
    title: str
    other_members: list[str]
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int


class NotificationView(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    entity_type: str | None = None
    entity_id: str | None = None
    read_at: datetime | None = None
    created_at: datetime


class StudySessionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    subject: Annotated[str, Field(min_length=1, max_length=80)]
    topic: Annotated[str, Field(min_length=1, max_length=160)]
    starts_at: datetime
    duration_minutes: Annotated[int, Field(ge=15, le=480)] = 60
    study_format: StudyFormat
    meeting_details: Annotated[str, Field(max_length=1000)] = ""
    max_participants: Annotated[int, Field(ge=2, le=50)] = 6
    invited_user_ids: Annotated[list[UUID], Field(max_length=49)] = Field(default_factory=list)

    @field_validator("starts_at")
    @classmethod
    def require_future_timezone_aware_datetime(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Choose a date and time with a timezone.")
        if value <= datetime.now(UTC):
            raise ValueError("Study sessions must start in the future.")
        return value

    @field_validator("invited_user_ids")
    @classmethod
    def require_unique_invitees(cls, values: list[UUID]) -> list[UUID]:
        if len(set(values)) != len(values):
            raise ValueError("Invite each student only once.")
        return values


class SessionParticipantView(BaseModel):
    student_id: str
    full_name: str
    status: InvitationStatus


class StudySessionView(BaseModel):
    id: str
    owner_id: str
    current_user_id: str
    owner_name: str
    subject: str
    topic: str
    starts_at: datetime
    duration_minutes: int
    study_format: StudyFormat
    meeting_details: str
    max_participants: int
    status: SessionStatus
    participants: list[SessionParticipantView]


class SessionInvitationDecision(BaseModel):
    accept: bool


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: Annotated[str, Field(min_length=2, max_length=80)]
    email: Annotated[EmailStr, Field(max_length=254)]
    password: Annotated[str, Field(min_length=8, max_length=128)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: Annotated[EmailStr, Field(max_length=254)]
    password: Annotated[str, Field(min_length=8, max_length=128)]


class RefreshRequest(BaseModel):
    refresh_token: Annotated[str, Field(min_length=20, max_length=4096)]


class VerifyEmailRequest(BaseModel):
    token: Annotated[str, Field(min_length=20, max_length=4096)]


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: Annotated[EmailStr, Field(max_length=254)]


class ResendVerificationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: Annotated[EmailStr, Field(max_length=254)]


class ResetPasswordRequest(BaseModel):
    token: Annotated[str, Field(min_length=20, max_length=4096)]
    password: Annotated[str, Field(min_length=8, max_length=128)]


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class AuthUserView(BaseModel):
    id: str
    email: str
    email_verified: bool
    full_name: str
