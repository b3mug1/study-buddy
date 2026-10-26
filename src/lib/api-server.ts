import "server-only";

import { cookies } from "next/headers";

const ACCESS_COOKIE = "study_access";
const REFRESH_COOKIE = "study_refresh";

function getApiUrl() {
  const url = process.env.API_URL;
  if (url) return url;
  if (process.env.NODE_ENV !== "production") return "http://localhost:8000";
  throw new Error("Set API_URL to the deployed FastAPI base URL.");
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as { access_token: string };
}

export async function requestApiFromServer(path: string) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && refreshToken) {
    accessToken = (await refreshAccessToken(refreshToken))?.access_token;
  }
  if (!accessToken) {
    return new Response(
      JSON.stringify({ detail: "Authentication required." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const send = (token: string) =>
    fetch(`${getApiUrl()}/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

  let response = await send(accessToken);
  if (response.status === 401 && refreshToken) {
    const renewed = await refreshAccessToken(refreshToken);
    if (renewed) response = await send(renewed.access_token);
  }
  return response;
}

export async function getApiError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    if (typeof payload.detail === "string") return payload.detail;
  }
  return fallback;
}

export async function getApiData<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(await getApiError(response, fallback));
  }
  return (await response.json()) as T;
}
