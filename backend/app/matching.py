from dataclasses import dataclass
from datetime import time
from typing import Any


@dataclass(frozen=True)
class Compatibility:
    score: int
    shared_subjects: list[str]
    explanation: list[str]
    breakdown: dict[str, int]


WEIGHTS = {
    "subjects": 0.40,
    "availability": 0.30,
    "learning_goals": 0.15,
    "study_format": 0.10,
    "language": 0.05,
}


def _normalized_overlap(first: list[str], second: list[str]) -> float:
    left = {item.strip().casefold() for item in first if item.strip()}
    right = {item.strip().casefold() for item in second if item.strip()}
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def _as_time(value: str | time) -> time:
    if isinstance(value, time):
        return value
    return time.fromisoformat(value)


def _duration(start: time, end: time) -> int:
    return end.hour * 60 + end.minute - (start.hour * 60 + start.minute)


def _availability_overlap(
    first: list[dict[str, Any]],
    second: list[dict[str, Any]],
) -> float:
    first_by_day = {int(item["weekday"]): item for item in first}
    second_by_day = {int(item["weekday"]): item for item in second}
    overlap = 0
    total = 0

    for weekday in first_by_day.keys() | second_by_day.keys():
        first_slot = first_by_day.get(weekday)
        second_slot = second_by_day.get(weekday)
        first_minutes = (
            _duration(_as_time(first_slot["start_time"]), _as_time(first_slot["end_time"]))
            if first_slot
            else 0
        )
        second_minutes = (
            _duration(
                _as_time(second_slot["start_time"]),
                _as_time(second_slot["end_time"]),
            )
            if second_slot
            else 0
        )

        common_minutes = 0
        if first_slot and second_slot:
            common_start = max(
                _as_time(first_slot["start_time"]),
                _as_time(second_slot["start_time"]),
            )
            common_end = min(
                _as_time(first_slot["end_time"]),
                _as_time(second_slot["end_time"]),
            )
            if common_start < common_end:
                common_minutes = _duration(common_start, common_end)
        overlap += common_minutes
        total += first_minutes + second_minutes - common_minutes

    return overlap / total if total else 0.0


def _format_compatibility(first: str, second: str) -> float:
    if first == second:
        return 1.0
    if "hybrid" in (first, second):
        return 0.75
    return 0.0


def score_compatibility(
    current: dict[str, Any],
    candidate: dict[str, Any],
) -> Compatibility:
    current_subjects = current["subjects"]
    candidate_subjects = candidate["subjects"]
    candidate_lookup = {subject.casefold(): subject for subject in candidate_subjects}
    shared_subjects = sorted(
        {
            candidate_lookup[subject.casefold()]
            for subject in current_subjects
            if subject.casefold() in candidate_lookup
        },
        key=str.casefold,
    )

    subject_score = _normalized_overlap(current_subjects, candidate_subjects)
    availability_score = _availability_overlap(
        current["availability"],
        candidate["availability"],
    )
    goal_score = _normalized_overlap(
        current["learning_goals"],
        candidate["learning_goals"],
    )
    format_score = _format_compatibility(
        current["study_format"],
        candidate["study_format"],
    )
    language_score = float(
        current["language"].strip().casefold() == candidate["language"].strip().casefold()
    )

    components = {
        "subjects": subject_score,
        "availability": availability_score,
        "learning_goals": goal_score,
        "study_format": format_score,
        "language": language_score,
    }
    breakdown = {name: round(value * 100) for name, value in components.items()}
    score = round(sum(components[name] * weight for name, weight in WEIGHTS.items()) * 100)

    explanation = []
    if shared_subjects:
        explanation.append("You both study " + ", ".join(shared_subjects[:4]) + ".")
    if availability_score:
        explanation.append(f"Your study times overlap by about {round(availability_score * 100)}%.")
    if goal_score:
        explanation.append("You share learning goals.")
    if format_score:
        explanation.append("Your study format preferences are compatible.")
    if language_score:
        explanation.append("You have the same preferred study language.")
    if not explanation:
        explanation.append("Your compatibility score is based on the profile details available.")

    return Compatibility(
        score=score,
        shared_subjects=shared_subjects,
        explanation=explanation,
        breakdown=breakdown,
    )
