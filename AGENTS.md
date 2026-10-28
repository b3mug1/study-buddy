# Project instructions

## Frontend

- The browser application uses React 19, React Router, and Vite.
- The application entry point is `src/main.tsx`; routes are configured in `src/App.tsx`.
- Shared UI lives in `src/components`; global styles are in `src/styles.css`.
- `npm run dev` starts Vite on port `1000` and the same-origin API proxy on port `1001`.
- The API proxy is implemented in `server/index.mjs` and forwards protected requests to FastAPI.
- Keep access and refresh tokens in HttpOnly cookies managed by the API proxy. Never expose them to browser storage.
- Use `VITE_API_URL` only for browser-side WebSocket connections. Keep `API_URL`, database URLs, and JWT secrets server-side.
- Tailwind CSS 4 is integrated through the official Vite plugin.

## Backend

- FastAPI lives in `backend/app`; database migrations live in `migrations`.
- Scope data access to the authenticated user and validate untrusted input at the API boundary.
- Keep credentials out of source control and logs.

## Validation

- Run `npm run typecheck`, `npm run lint`, and `npm run build` for frontend changes.
- Run `npm run api:test` and `npm run api:lint` for backend changes.
- Do not claim a live PostgreSQL or Docker runtime was verified unless it was actually started and checked.
