"use client";

import type { ValidProfile } from "@/lib/schemas/profile";

function getApiErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return "Some profile details are invalid. Review the form and try again.";
    }
  }
  return "The Study Buddy API could not complete this request. Please try again.";
}

export async function authenticatedApiRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api/backend/api/v1/${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "The Study Buddy API is unavailable. Start the FastAPI server and try again.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(getApiErrorMessage(payload));
  }
  return response;
}

export async function authenticatedApiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedApiRequest(path, init);
  if (response.status === 204) {
    throw new Error(
      "The API returned no data for a request that expected JSON.",
    );
  }
  return (await response.json()) as T;
}

export async function saveStudentProfile(values: ValidProfile): Promise<void> {
  await authenticatedApiRequest("profile", {
    method: "PUT",
    body: JSON.stringify({
      full_name: values.fullName,
      university_name: values.universityName,
      major: values.major,
      year_of_study: values.yearOfStudy,
      bio: values.bio,
      subjects: values.subjects,
      learning_goals: values.learningGoals,
      availability_days: values.availabilityDays.map(Number),
      preferred_hours: values.preferredHours,
      study_format: values.studyFormat,
      group_size: values.groupSize,
      language: values.language,
      show_in_discovery: values.showInDiscovery,
    }),
  });
}
