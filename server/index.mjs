import { config as loadEnv } from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const ACCESS_COOKIE = "study_access";
const REFRESH_COOKIE = "study_refresh";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const isProduction =
  process.env.NODE_ENV === "production" || process.argv.includes("--production");
const apiUrl = process.env.API_URL || "http://localhost:8000";
const port = Number(
  process.env.API_PROXY_PORT || (isProduction ? 1000 : 1001),
);
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "..");

const app = express();
app.disable("x-powered-by");
app.use(express.raw({ type: () => true, limit: "20mb" }));

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

function isAllowedOrigin(request) {
  const origin = request.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestHost = (
      request.get("x-forwarded-host") || request.get("host") || ""
    )
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (requestHost && originUrl.host.toLowerCase() === requestHost) return true;

    if (process.env.FRONTEND_URL) {
      return (
        originUrl.origin.toLowerCase() ===
        new URL(process.env.FRONTEND_URL).origin.toLowerCase()
      );
    }
  } catch {
    return false;
  }
  return false;
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAge * 1000,
  };
}

function clearSessionCookies(response) {
  response.cookie(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookie(REFRESH_COOKIE, "", cookieOptions(0));
}

function setSessionCookies(response, tokens) {
  const accessMaxAge =
    typeof tokens.expires_in === "number" ? tokens.expires_in : 900;
  response.cookie(
    ACCESS_COOKIE,
    tokens.access_token,
    cookieOptions(accessMaxAge),
  );
  response.cookie(
    REFRESH_COOKIE,
    tokens.refresh_token,
    cookieOptions(REFRESH_MAX_AGE),
  );
}

function isAuthTokens(payload) {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.access_token === "string" &&
    typeof payload.refresh_token === "string"
  );
}

function parseJsonBody(body) {
  if (!Buffer.isBuffer(body)) return null;
  try {
    const value = JSON.parse(body.toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

async function refreshTokens(refreshToken) {
  const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return isAuthTokens(payload) ? payload : null;
}

const authEndpoints = new Set([
  "register",
  "login",
  "verify-email",
  "forgot-password",
  "reset-password",
  "logout",
]);

app.post("/api/auth/:action", async (request, response) => {
  if (!isAllowedOrigin(request)) {
    return response.status(403).json({ detail: "Invalid request origin." });
  }

  const { action } = request.params;
  if (!authEndpoints.has(action)) {
    return response.status(404).json({ detail: "Unknown authentication action." });
  }

  const body = parseJsonBody(request.body);
  if (!body) {
    return response
      .status(400)
      .json({ detail: "A valid JSON request body is required." });
  }
  if (action === "logout") {
    body.refresh_token = readCookie(request, REFRESH_COOKIE);
  }

  let apiResponse;
  try {
    apiResponse = await fetch(`${apiUrl}/api/v1/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    response.set("Cache-Control", "no-store");
    if (action === "logout") clearSessionCookies(response);
    return response.status(503).json({
      detail:
        "The authentication API is unavailable. Start the FastAPI server and try again.",
    });
  }

  const payload =
    apiResponse.status === 204
      ? { success: true }
      : await apiResponse.json().catch(() => null);
  const hasTokens = isAuthTokens(payload);
  response.set("Cache-Control", "no-store");

  if (action === "logout" || (action === "reset-password" && apiResponse.ok)) {
    clearSessionCookies(response);
  } else if (apiResponse.ok && hasTokens) {
    setSessionCookies(response, payload);
  }

  return response
    .status(apiResponse.status === 204 ? 200 : apiResponse.status)
    .json(hasTokens ? { success: true } : payload);
});

async function forwardApiRequest(request, response) {
  const requestUrl = new URL(request.originalUrl, "http://localhost");
  const rawPath = requestUrl.pathname.slice("/api/backend/".length);
  let pathParts;
  try {
    pathParts = rawPath.split("/").map(decodeURIComponent);
  } catch {
    return response.status(400).json({ detail: "Invalid API path." });
  }

  if (
    !pathParts.length ||
    pathParts.some((part) => !part || part === "." || part === "..") ||
    pathParts[0] !== "api" ||
    pathParts[1] !== "v1"
  ) {
    return response.status(404).json({ detail: "Unknown API route." });
  }
  if (pathParts[2] === "auth" && pathParts[3] !== "me") {
    return response.status(404).json({
      detail: "Authentication endpoints are only available through the auth proxy.",
    });
  }

  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isAllowedOrigin(request)
  ) {
    return response.status(403).json({ detail: "Invalid request origin." });
  }

  const upstreamUrl = new URL(
    `/${pathParts.map(encodeURIComponent).join("/")}${requestUrl.search}`,
    apiUrl,
  );
  const headers = new Headers();
  const contentType = request.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let accessToken = readCookie(request, ACCESS_COOKIE);
  let refreshToken = readCookie(request, REFRESH_COOKIE);
  let refreshed = null;
  if (!accessToken && refreshToken) {
    refreshed = await refreshTokens(refreshToken).catch(() => null);
    accessToken = refreshed?.access_token;
    refreshToken = refreshed?.refresh_token ?? refreshToken;
  }
  if (!accessToken) {
    return response.status(401).json({
      detail: "Your session has expired. Sign in and try again.",
    });
  }

  const send = (token) => {
    const authenticatedHeaders = new Headers(headers);
    authenticatedHeaders.set("Authorization", `Bearer ${token}`);
    return fetch(upstreamUrl, {
      method: request.method,
      headers: authenticatedHeaders,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : Buffer.isBuffer(request.body) && request.body.length
          ? request.body
          : undefined,
      cache: "no-store",
    });
  };

  let apiResponse;
  try {
    apiResponse = await send(accessToken);
    if (apiResponse.status === 401 && refreshToken) {
      refreshed = await refreshTokens(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        apiResponse = await send(accessToken);
      }
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return response.status(503).json({
      detail: "The Study Buddy API is unavailable. Please try again.",
    });
  }

  for (const name of [
    "content-type",
    "content-disposition",
    "x-content-type-options",
  ]) {
    const value = apiResponse.headers.get(name);
    if (value) response.set(name, value);
  }
  response.set("Cache-Control", "no-store");
  if (refreshed) setSessionCookies(response, refreshed);
  response.status(apiResponse.status);

  if (request.method === "HEAD" || apiResponse.status === 204) {
    return response.end();
  }
  return response.send(Buffer.from(await apiResponse.arrayBuffer()));
}

app.use("/api/backend", forwardApiRequest);
app.get("/health", (_request, response) => response.json({ status: "ok" }));

if (isProduction) {
  const staticDirectory = path.join(projectDirectory, "dist");
  app.use(express.static(staticDirectory, { index: false }));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api/")) {
      return response.sendFile(path.join(staticDirectory, "index.html"), (error) => {
        if (error) next(error);
      });
    }
    return next();
  });
}

app.use((request, response) => {
  if (request.path.startsWith("/api/")) {
    return response.status(404).json({ detail: "Unknown API route." });
  }
  return response.status(404).send("Not found");
});

app.use((error, _request, response, next) => {
  console.error("Request failed:", error);
  if (response.headersSent) return next(error);
  response.status(500).json({ detail: "The request could not be completed." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Study Buddy API proxy listening on port ${port}`);
});
