import { NextResponse, type NextRequest } from "next/server";
import { isAllowedOrigin } from "@/lib/security";

const ACCESS_COOKIE = "study_access";
const REFRESH_COOKIE = "study_refresh";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function getApiUrl() {
  const url = process.env.API_URL;
  if (url) return url;
  if (process.env.NODE_ENV !== "production") return "http://localhost:8000";
  throw new Error("Set API_URL to the deployed FastAPI base URL.");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

async function exchangeRefreshToken(refreshToken: string) {
  const response = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isAllowedOrigin(request)
  ) {
    return NextResponse.json(
      { detail: "Invalid request origin." },
      { status: 403 },
    );
  }
  if (!path.length || path[0] !== "api" || path[1] !== "v1") {
    return NextResponse.json({ detail: "Unknown API route." }, { status: 404 });
  }
  if (path[2] === "auth" && !["me"].includes(path[3] ?? "")) {
    return NextResponse.json(
      {
        detail:
          "Authentication endpoints are only available through the auth proxy.",
      },
      { status: 404 },
    );
  }
  const url = new URL(
    `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    getApiUrl(),
  );
  const method = request.method;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null = null;

  if (!accessToken && refreshToken) {
    refreshed = await exchangeRefreshToken(refreshToken);
    accessToken = refreshed?.access_token;
    refreshToken = refreshed?.refresh_token ?? refreshToken;
  }
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Your session has expired. Sign in and try again." },
      { status: 401 },
    );
  }

  const send = (token: string) => {
    const authenticatedHeaders = new Headers(headers);
    authenticatedHeaders.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      method,
      headers: authenticatedHeaders,
      body,
      cache: "no-store",
    });
  };

  let apiResponse: Response;
  try {
    apiResponse = await send(accessToken);
    if (apiResponse.status === 401 && refreshToken) {
      refreshed = await exchangeRefreshToken(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        apiResponse = await send(accessToken);
      }
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return NextResponse.json(
      { detail: "The Study Buddy API is unavailable. Please try again." },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  const apiContentType = apiResponse.headers.get("content-type");
  if (apiContentType) responseHeaders.set("Content-Type", apiContentType);
  responseHeaders.set("Cache-Control", "no-store");
  const response = new NextResponse(
    apiResponse.status === 204 ? null : await apiResponse.arrayBuffer(),
    { status: apiResponse.status, headers: responseHeaders },
  );
  if (refreshed) {
    response.cookies.set(
      ACCESS_COOKIE,
      refreshed.access_token,
      cookieOptions(refreshed.expires_in),
    );
    response.cookies.set(
      REFRESH_COOKIE,
      refreshed.refresh_token,
      cookieOptions(REFRESH_MAX_AGE),
    );
  }
  return response;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
