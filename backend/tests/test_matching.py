from app.matching import score_compatibility


def candidate(
    *,
    subjects: list[str],
    goals: list[str],
    availability: list[dict[str, object]],
    study_format: str = "online",
    language: str = "English",
) -> dict[str, object]:
    return {
        "subjects": subjects,
        "learning_goals": goals,
        "availability": availability,
        "study_format": study_format,
        "language": language,
    }


def slot(weekday: int, start: str, end: str) -> dict[str, object]:
    return {"weekday": weekday, "start_time": start, "end_time": end}


def test_identical_profiles_score_one_hundred() -> None:
    profile = candidate(
        subjects=["Biology", "Statistics"],
        goals=["Prepare for exams"],
        availability=[slot(1, "09:00:00", "12:00:00")],
    )

    result = score_compatibility(profile, profile)

    assert result.score == 100
    assert result.breakdown == {
        "subjects": 100,
        "availability": 100,
        "learning_goals": 100,
        "study_format": 100,
        "language": 100,
    }
    assert result.shared_subjects == ["Biology", "Statistics"]


def test_each_match_dimension_is_weighted_and_explained() -> None:
    current = candidate(
        subjects=["Biology", "Math"],
        goals=["Exam preparation"],
        availability=[slot(2, "09:00:00", "12:00:00")],
    )
    student = candidate(
        subjects=["math", "Writing"],
        goals=["Exam preparation"],
        availability=[slot(2, "11:00:00", "14:00:00")],
        study_format="hybrid",
    )

    result = score_compatibility(current, student)

    assert result.breakdown == {
        "subjects": 33,
        "availability": 20,
        "learning_goals": 100,
        "study_format": 75,
        "language": 100,
    }
    assert result.score == 47
    assert result.shared_subjects == ["math"]
    assert any("overlap" in explanation for explanation in result.explanation)


def test_disjoint_subjects_goals_schedule_and_preferences_score_zero() -> None:
    current = candidate(
        subjects=["Chemistry"],
        goals=["Exam preparation"],
        availability=[slot(1, "09:00:00", "10:00:00")],
        study_format="online",
        language="English",
    )
    student = candidate(
        subjects=["History"],
        goals=["Build confidence"],
        availability=[slot(5, "17:00:00", "18:00:00")],
        study_format="offline",
        language="French",
    )

    result = score_compatibility(current, student)

    assert result.score == 0
    assert result.shared_subjects == []
    assert len(result.explanation) == 1


def test_weekday_overlap_and_case_insensitive_language() -> None:
    current = candidate(
        subjects=["Biology"],
        goals=["Practice"],
        availability=[slot(1, "08:00:00", "10:00:00")],
        language="English",
    )
    student = candidate(
        subjects=["biology"],
        goals=["practice"],
        availability=[slot(1, "09:00:00", "11:00:00")],
        language="english",
    )

    result = score_compatibility(current, student)

    assert result.breakdown["subjects"] == 100
    assert result.breakdown["availability"] == 33
    assert result.breakdown["language"] == 100
    assert result.shared_subjects == ["biology"]
