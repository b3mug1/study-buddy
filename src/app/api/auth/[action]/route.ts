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

function isAuthTokens(payload: unknown): payload is {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "access_token" in payload &&
    typeof payload.access_token === "string" &&
    "refresh_token" in payload &&
    typeof payload.refresh_token === "string"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { detail: "Invalid request origin." },
      { status: 403 },
    );
  }
  const routes: Record<string, string> = {
    register: "register",
    login: "login",
    "verify-email": "verify-email",
    "forgot-password": "forgot-password",
    "reset-password": "reset-password",
    logout: "logout",
  };
  const endpoint = routes[action];
  if (!endpoint) {
    return NextResponse.json(
      { detail: "Unknown authentication action." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { detail: "A valid JSON request body is required." },
      { status: 400 },
    );
  }
  if (action === "logout") {
    (body as Record<string, unknown>).refresh_token =
      request.cookies.get(REFRESH_COOKIE)?.value ?? "";
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${getApiUrl()}/api/v1/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const response = NextResponse.json(
      {
        detail:
          "The authentication API is unavailable. Start the FastAPI server and try again.",
      },
      { status: 503 },
    );
    if (action === "logout") {
      response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
      response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
    }
    return response;
  }

  const payload: unknown =
    apiResponse.status === 204
      ? { success: true }
      : await apiResponse.json().catch(() => null);
  const hasTokens = isAuthTokens(payload);
  const response = NextResponse.json(hasTokens ? { success: true } : payload, {
    status: apiResponse.status === 204 ? 200 : apiResponse.status,
  });
  if (action === "logout" || (action === "reset-password" && apiResponse.ok)) {
    response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
    response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
  } else if (apiResponse.ok && isAuthTokens(payload)) {
    const expiresIn =
      "expires_in" in payload && typeof payload.expires_in === "number"
        ? payload.expires_in
        : 900;
    response.cookies.set(
      ACCESS_COOKIE,
      payload.access_token,
      cookieOptions(expiresIn),
    );
    response.cookies.set(
      REFRESH_COOKIE,
      payload.refresh_token,
      cookieOptions(REFRESH_MAX_AGE),
    );
  }
  return response;
}
