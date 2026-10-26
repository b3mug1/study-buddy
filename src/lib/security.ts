import { type NextRequest } from "next/server";

export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  if (origin === request.nextUrl.origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const hostHeader =
      request.headers.get("x-forwarded-host") || request.headers.get("host");

    if (
      hostHeader &&
      originUrl.host.toLowerCase() === hostHeader.toLowerCase()
    ) {
      return true;
    }

    if (process.env.FRONTEND_URL) {
      const frontendUrl = new URL(process.env.FRONTEND_URL);
      if (originUrl.origin.toLowerCase() === frontendUrl.origin.toLowerCase()) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
