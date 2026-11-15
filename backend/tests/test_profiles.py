import asyncio

import httpx

from app import discovery
from app.auth import get_current_user
from app.main import app
from app.schemas import DiscoverableStudent


def api_request(
    method: str,
    path: str,
    *,
    json: dict[str, object] | None = None,
) -> httpx.Response:
    async def send() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://study-buddy.test",
        ) as client:
            return await client.request(method, path, json=json)

    return asyncio.run(send())


class FakeDatabase:
    def rpc(self, name: str, params: dict[str, object]) -> "FakeRpc":
        assert name == "complete_onboarding"
        assert params["p_show_in_discovery"] is True
        return FakeRpc()


class FakeRpc:
    def execute(self) -> None:
        return None


def authenticated_user() -> object:
    class User:
        id = "00000000-0000-0000-0000-000000000001"
        db = FakeDatabase()

    return User()


def test_profile_write_requires_authentication() -> None:
    response = api_request("PUT", "/api/v1/profile", json={})
    assert response.status_code == 401


def test_all_collaboration_endpoints_require_authentication() -> None:
    protected_routes = [
        ("GET", "/api/v1/discover"),
        ("GET", "/api/v1/students/by-code/SB-ABCDEF123456"),
        (
            "GET",
            "/api/v1/students/00000000-0000-0000-0000-000000000001",
        ),
        ("GET", "/api/v1/connections"),
        ("POST", "/api/v1/connections"),
        ("GET", "/api/v1/groups"),
        ("POST", "/api/v1/groups"),
        ("GET", "/api/v1/conversations"),
        ("GET", "/api/v1/notifications"),
        ("GET", "/api/v1/sessions"),
        ("POST", "/api/v1/sessions"),
    ]

    for method, path in protected_routes:
        response = api_request(method, path, json={} if method == "POST" else None)
        assert response.status_code == 401, f"{method} {path} was not protected"


def test_profile_write_rejects_invalid_fields() -> None:
    app.dependency_overrides[get_current_user] = authenticated_user
    try:
        response = api_request(
            "PUT",
            "/api/v1/profile",
            json={
                "full_name": "A",
                "university_name": "North University",
                "major": "Biology",
                "year_of_study": 2,
                "bio": "",
                "subjects": ["Biology"],
                "learning_goals": ["Prepare for exams"],
                "availability_days": [7],
                "preferred_hours": "afternoon",
                "study_format": "hybrid",
                "group_size": 4,
                "language": "English",
                "show_in_discovery": True,
            },
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_student_code_lookup_rejects_malformed_codes() -> None:
    app.dependency_overrides[get_current_user] = authenticated_user
    try:
        response = api_request("GET", "/api/v1/students/by-code/not-a-code")
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_student_code_lookup_opens_the_matching_profile(monkeypatch) -> None:
    student_id = "00000000-0000-0000-0000-000000000042"
    query_calls: list[tuple[str, str]] = []

    class Query:
        def select(self, columns: str) -> "Query":
            assert columns == "id"
            return self

        def eq(self, column: str, value: str) -> "Query":
            query_calls.append((column, value))
            return self

        def maybe_single(self) -> "Query":
            return self

        def execute(self) -> object:
            return type("Result", (), {"data": {"id": student_id}})()

    class Database:
        def table(self, name: str) -> Query:
            assert name == "profiles"
            return Query()

    class User:
        id = "00000000-0000-0000-0000-000000000001"
        db = Database()

    student = DiscoverableStudent(
        id=student_id,
        full_name="Alex Student",
        university_name="North University",
        major="Biology",
        year_of_study=2,
        bio="",
        subjects=[],
        study_format="hybrid",
        preferred_hours="afternoon",
        availability_days=[],
        compatibility=0,
        shared_subjects=[],
        explanation=[],
        breakdown={
            "subjects": 0,
            "availability": 0,
            "learning_goals": 0,
            "study_format": 0,
            "language": 0,
        },
        connection_status=None,
        connection_direction=None,
    )
    monkeypatch.setattr(
        discovery,
        "get_student_profile",
        lambda profile_id, _user: student
        if str(profile_id) == student_id
        else None,
    )
    app.dependency_overrides[get_current_user] = User
    try:
        response = api_request(
            "GET", "/api/v1/students/by-code/sb-abcdef123456"
        )
        assert response.status_code == 200
        assert response.json()["id"] == student_id
        assert query_calls == [("student_code", "SB-ABCDEF123456")]
    finally:
        app.dependency_overrides.clear()


def test_profile_write_calls_atomic_onboarding_rpc() -> None:
    app.dependency_overrides[get_current_user] = authenticated_user
    try:
        response = api_request(
            "PUT",
            "/api/v1/profile",
            json={
                "full_name": "Alex Student",
                "university_name": "North University",
                "major": "Biology",
                "year_of_study": 2,
                "bio": "Enjoys study groups.",
                "subjects": ["Biology", "Statistics"],
                "learning_goals": ["Prepare for exams"],
                "availability_days": [1, 3, 5],
                "preferred_hours": "afternoon",
                "study_format": "hybrid",
                "group_size": 4,
                "language": "English",
                "show_in_discovery": True,
            },
        )
        assert response.status_code == 204
    finally:
        app.dependency_overrides.clear()
