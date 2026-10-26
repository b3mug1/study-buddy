# Study Buddy

**Find your people. Study smarter.**

Study Buddy is a university collaboration app built with a React/Next.js frontend, a Python FastAPI backend, and self-managed PostgreSQL. Authentication, profiles, study groups, connections, messages, notifications, and sessions are stored in PostgreSQL.

## Architecture

```text
Browser (React / Next.js)
  ├── same-origin API proxy + HttpOnly access/refresh cookies
  └── one-time WebSocket tickets for live message events
        ↓
Python FastAPI
  ├── Argon2 password hashing
  ├── short-lived signed JWT access tokens
  ├── persisted, revocable refresh sessions
  ├── SMTP email verification and password recovery
  └── parameterized PostgreSQL operations and ownership checks
        ↓
Private PostgreSQL database
```

Passwords are hashed with Argon2. JWTs are signed with `JWT_SECRET_KEY`; the browser never reads them because Next.js stores them in `HttpOnly`, `SameSite=Lax` cookies. The Next.js server forwards the access token to FastAPI. Refresh tokens are stored as SHA-256 hashes in PostgreSQL and can be revoked on logout or password reset.

All database access is through the FastAPI service. Database values are parameterized, database identifiers are allowlisted, and the query layer adds per-user authorization predicates. Keep PostgreSQL private (not reachable from browsers or the public internet), use a dedicated application database account, require TLS for remote connections, and never expose `DATABASE_URL` to the frontend. PostgreSQL RLS is not enabled: authorization is enforced in the backend, so do not add another path that lets untrusted clients connect directly to the database.

## Database model and migrations

[`migrations/001_initial.sql`](./migrations/001_initial.sql) creates users and auth tokens, profiles, subjects, availability/preferences, connections, groups/membership, conversations/messages, notifications, and sessions/invitations. It also creates indexes, constraints, update timestamps, message notifications, cancellation notifications, and database write-rate limits.

Apply the migration once to an empty PostgreSQL database:

```powershell
$env:DATABASE_URL = "postgresql://study_buddy:your-password@localhost:5432/study_buddy"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations\001_initial.sql
```

For production, run migrations with a migration/owner role, run FastAPI with a separate restricted role, allow that role only the required table/sequence/function privileges, and restrict incoming database connections to the API host.

## API

FastAPI API routes are under `/api/v1`. Protected routes use a bearer access token; the browser accesses them through the same-origin Next.js proxy.

| Method         | Path                                               | Purpose                                                  |
| -------------- | -------------------------------------------------- | -------------------------------------------------------- |
| `GET`          | `/health`                                          | Liveness                                                 |
| `POST`         | `/api/v1/auth/register`                            | Create an account and send email verification            |
| `POST`         | `/api/v1/auth/login`                               | Verify credentials and issue access/refresh tokens       |
| `POST`         | `/api/v1/auth/verify-email`                        | Verify an email token                                    |
| `POST`         | `/api/v1/auth/forgot-password`                     | Send a reset link                                        |
| `POST`         | `/api/v1/auth/reset-password`                      | Set a new password and revoke old sessions               |
| `POST`         | `/api/v1/auth/refresh`                             | Exchange a persisted refresh session for an access token |
| `POST`         | `/api/v1/auth/logout`                              | Revoke a refresh session                                 |
| `GET`          | `/api/v1/auth/me`                                  | Read the current user                                    |
| `GET`, `PUT`   | `/api/v1/profile`                                  | Read or save the current student's profile               |
| `GET`          | `/api/v1/dashboard`                                | Database-backed dashboard and recommendations            |
| `GET`          | `/api/v1/discover`                                 | Search and rank discoverable students                    |
| `GET`          | `/api/v1/students/{student_id}`                    | Read an authorized student profile                       |
| `GET`, `POST`  | `/api/v1/connections`                              | List connections or send a request                       |
| `POST`         | `/api/v1/connections/{connection_id}/respond`      | Accept or decline a request                              |
| `GET`, `POST`  | `/api/v1/groups`                                   | Search or create groups                                  |
| `GET`, `PATCH` | `/api/v1/groups/{group_id}`                        | Read or update a group                                   |
| `POST`         | `/api/v1/groups/{group_id}/join`                   | Join a public group or request private access            |
| `POST`         | `/api/v1/groups/requests/{request_id}/respond`     | Approve or decline a join request                        |
| `DELETE`       | `/api/v1/groups/{group_id}/members/{student_id}`   | Leave or remove a group member                           |
| `GET`          | `/api/v1/conversations`                            | List authorized conversations                            |
| `GET`, `POST`  | `/api/v1/conversations/{conversation_id}/messages` | Read or send paginated messages                          |
| `POST`         | `/api/v1/conversations/{conversation_id}/read`     | Mark conversation messages read                          |
| `DELETE`       | `/api/v1/messages/{message_id}`                    | Delete the caller's own message                          |
| `GET`          | `/api/v1/notifications`                            | Read notifications                                       |
| `GET`          | `/api/v1/notifications/unread-count`               | Count unread notifications                               |
| `PATCH`        | `/api/v1/notifications/{notification_id}/read`     | Mark one notification read                               |
| `POST`         | `/api/v1/notifications/read-all`                   | Mark all notifications read                              |
| `GET`, `POST`  | `/api/v1/sessions`                                 | List or create study sessions                            |
| `POST`         | `/api/v1/sessions/{session_id}/invitation`         | Accept or decline an invitation                          |
| `DELETE`       | `/api/v1/sessions/{session_id}`                    | Cancel a session as its owner                            |

FastAPI OpenAPI docs are at `http://localhost:8000/docs`.

## Matching

Matching is deterministic and does not use a paid AI API:

- Shared subjects: **40%**, case-insensitive Jaccard overlap
- Availability: **30%**, shared weekly time divided by total union time
- Learning goals: **15%**, case-insensitive Jaccard overlap
- Study format: **10%**, exact match or partial hybrid compatibility
- Language: **5%**, case-insensitive exact match

Discovery filters by name, university, subject, available weekday, and format, then sorts by compatibility and explains each score.

## Project structure

```text
backend/app/             FastAPI auth, PostgreSQL access, domain API
backend/tests/           API authorization and matching tests
migrations/              PostgreSQL schema and notification/rate-limit triggers
src/app/                 Next.js routes and cookie-backed protected layouts
src/app/api/              Same-origin auth and authenticated API proxies
src/components/           React auth, profile, discovery, groups, chat, sessions
src/lib/                  API clients, schemas, and shared types
e2e/                      Playwright UI/API smoke tests
```

## Requirements and local setup (Windows PowerShell)

- Node.js 20.9+
- Python 3.12+
- PostgreSQL 15+
- npm and `psql`
- An SMTP account for verification and password reset emails

1. Install frontend dependencies:

   ```powershell
   npm install
   ```

2. Create a Python virtual environment and install the API:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -e "backend[test]"
   ```

3. Create an empty local database/user and apply the migration.

4. Copy `.env.example` to `.env.local`, set the private PostgreSQL connection, generate a random JWT secret, and configure SMTP:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Set the generated value as `JWT_SECRET_KEY`. Configure the remaining values as follows:

   ```dotenv
   DATABASE_URL=postgresql://study_buddy:your-password@localhost:5432/study_buddy
   JWT_SECRET_KEY=replace-with-generated-random-value
   API_URL=http://localhost:8000
   NEXT_PUBLIC_API_URL=http://localhost:8000
   FRONTEND_URL=http://localhost:3000
   CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USERNAME=your-smtp-username
   SMTP_PASSWORD=your-smtp-password
   SMTP_FROM_EMAIL=study-buddy@example.com
   SMTP_USE_TLS=true
   ```

   SMTP credentials and `DATABASE_URL` are server-only. Do not prefix them with `NEXT_PUBLIC_`.

5. Start the API and frontend in separate terminals:

   ```powershell
   npm run api:dev
   npm run dev
   ```

6. Open `http://localhost:3000`. Registration sends an email verification link; sign-in is enabled after verification.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run api:test
npm run api:lint
npm run test:e2e
npm run format:check
npm run build
```

Unit/API tests cover profile validation, match-score calculations, and rejection of unauthenticated API calls. Playwright covers the public UI, mobile overflow, client-side validation, and API auth rejection. Authenticated database workflows require a running PostgreSQL instance and SMTP testing account.

## Deployment and operational security

Deploy Next.js and FastAPI to trusted hosts and PostgreSQL to a private managed or self-hosted database. Set `API_URL` on the Next.js server, `NEXT_PUBLIC_API_URL` to the reachable HTTPS API origin for WebSockets, and set `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`, CORS origins, and SMTP values on FastAPI. Use HTTPS/WSS, TLS to PostgreSQL, secret rotation, backups, and a dedicated database role. Configure reverse-proxy trusted hosts carefully; never accept user identity from arbitrary forwarded headers. Keep verification/reset tokens short-lived and single-use.

Email verification and recovery links are delivered by the configured SMTP provider. Without valid SMTP settings, registration and reset-email requests return a visible configuration/delivery error; no successful fake fallback is used.

## Current limitations

- PostgreSQL must be provisioned and the migration applied before persistent routes work.
- Messages use PostgreSQL `LISTEN/NOTIFY` over ticket-authorized WebSockets, with a polling fallback when the WebSocket endpoint is not reachable.
- A production SMTP provider and a private PostgreSQL deployment are external setup requirements.
- Avatar upload, calendar provider integrations, and authenticated database-backed E2E fixtures are not included.
