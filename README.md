# Study Buddy

**Find your people. Study smarter.**

Study Buddy is a university collaboration app built with a React and Vite frontend, a Python FastAPI backend, and self-managed PostgreSQL. Authentication, profiles, study groups, connections, messages, notifications, and sessions are stored in PostgreSQL.

## Architecture

```text
Browser (React / React Router / Vite)
  ├── same-origin Express API proxy + HttpOnly access/refresh cookies
  └── one-time WebSocket tickets for live message events
        ↓
Python FastAPI
  ├── Argon2 password hashing
  ├── short-lived signed JWT access tokens
  ├── persisted, revocable refresh sessions
  └── parameterized PostgreSQL operations and ownership checks
        ↓
Private PostgreSQL database
```

Passwords are hashed with Argon2. JWTs are signed with `JWT_SECRET_KEY`; the browser never reads them because the Express API proxy stores them in `HttpOnly`, `SameSite=Lax` cookies. The proxy forwards the access token to FastAPI. Refresh tokens are stored as SHA-256 hashes in PostgreSQL and can be revoked on logout or password reset.

All database access is through the FastAPI service. Database values are parameterized, database identifiers are allowlisted, and the query layer adds per-user authorization predicates. Keep PostgreSQL private (not reachable from browsers or the public internet), use a dedicated application database account, require TLS for remote connections, and never expose `DATABASE_URL` to the frontend. PostgreSQL RLS is not enabled: authorization is enforced in the backend, so do not add another path that lets untrusted clients connect directly to the database.

## Database model and migrations

[`migrations/001_initial.sql`](./migrations/001_initial.sql) creates users and auth tokens, profiles, subjects, availability/preferences, connections, groups/membership, conversations/messages, notifications, and sessions/invitations. [`migrations/002_collaboration_features.sql`](./migrations/002_collaboration_features.sql) adds session outcomes, group tasks and materials, shared focus timers, weekly goals with topic checklists, and safety reports/blocks. [`migrations/003_intro_message_limits.sql`](./migrations/003_intro_message_limits.sql) adds the counter used to enforce the three-message chat-request limit.

Apply the migration once to an empty PostgreSQL database:

```powershell
$env:DATABASE_URL = "postgresql://study_buddy:your-password@localhost:5432/study_buddy"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations\001_initial.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations\002_collaboration_features.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations\003_intro_message_limits.sql
```

If the database already exists, apply each migration it is missing in numerical order, once. Existing PostgreSQL Docker volumes do not rerun `/docker-entrypoint-initdb.d` scripts automatically. For the Compose database, for example:

```powershell
docker compose exec -T db psql -1 -v ON_ERROR_STOP=1 -U study_buddy -d study_buddy -f /docker-entrypoint-initdb.d/003_intro_message_limits.sql
```

For production, run migrations with a migration/owner role, run FastAPI with a separate restricted role, allow that role only the required table/sequence/function privileges, and restrict incoming database connections to the API host.

## API

FastAPI API routes are under `/api/v1`. Protected routes use a bearer access token; the browser accesses them through the same-origin Express proxy.

| Method                           | Path                                                     | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `GET`                            | `/health`                                                | Liveness                                                 |
| `POST`                           | `/api/v1/auth/register`                                  | Create an account and issue an access session            |
| `POST`                           | `/api/v1/auth/login`                                     | Verify credentials and issue access/refresh tokens       |
| `POST`                           | `/api/v1/auth/verify-email`                              | Redeem a previously issued email token                   |
| `POST`                           | `/api/v1/auth/forgot-password`                           | Disabled; returns `501` because outbound email is off    |
| `POST`                           | `/api/v1/auth/reset-password`                            | Redeem a previously issued password-reset token          |
| `POST`                           | `/api/v1/auth/refresh`                                   | Exchange a persisted refresh session for an access token |
| `POST`                           | `/api/v1/auth/logout`                                    | Revoke a refresh session                                 |
| `GET`                            | `/api/v1/auth/me`                                        | Read the current user                                    |
| `GET`, `PUT`                     | `/api/v1/profile`                                        | Read or save the current student's profile               |
| `GET`                            | `/api/v1/dashboard`                                      | Database-backed dashboard and recommendations            |
| `GET`                            | `/api/v1/discover`                                       | Search and rank discoverable students                    |
| `GET`                            | `/api/v1/students/{student_id}`                          | Read an authorized student profile                       |
| `GET`, `POST`                    | `/api/v1/connections`                                    | List connections or send a request                       |
| `POST`                           | `/api/v1/connections/{connection_id}/respond`            | Accept or decline a request                              |
| `GET`, `POST`                    | `/api/v1/groups`                                         | Search or create groups                                  |
| `GET`, `PATCH`                   | `/api/v1/groups/{group_id}`                              | Read or update a group                                   |
| `POST`                           | `/api/v1/groups/{group_id}/join`                         | Join a public group or request private access            |
| `POST`                           | `/api/v1/groups/requests/{request_id}/respond`           | Approve or decline a join request                        |
| `DELETE`                         | `/api/v1/groups/{group_id}/members/{student_id}`         | Leave or remove a group member                           |
| `GET`, `POST`                    | `/api/v1/groups/{group_id}/tasks`                        | List or create group tasks                               |
| `PATCH`, `DELETE`                | `/api/v1/groups/{group_id}/tasks/{task_id}`              | Update status or remove a group task                     |
| `GET`, `POST`                    | `/api/v1/groups/{group_id}/materials`                    | List or add shared links, notes, and files (5 MB max)    |
| `GET`                            | `/api/v1/groups/{group_id}/materials/{material_id}/file` | Download a private group file                            |
| `DELETE`                         | `/api/v1/groups/{group_id}/materials/{material_id}`      | Remove a shared material                                 |
| `GET`, `POST`                    | `/api/v1/groups/{group_id}/focus`                        | Read or start the shared Pomodoro timer                  |
| `POST`                           | `/api/v1/groups/{group_id}/focus/{focus_id}/finish`      | Finish the shared focus session                          |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/goals`                                          | Manage personal weekly study goals                       |
| `POST`                           | `/api/v1/goals/{goal_id}/topics`                         | Add a topic to a study goal                              |
| `PATCH`, `DELETE`                | `/api/v1/goals/{goal_id}/topics/{topic_id}`              | Mark a topic complete or remove it                       |
| `GET`                            | `/api/v1/progress`                                       | Read completed sessions and weekly progress              |
| `GET`, `POST`, `DELETE`          | `/api/v1/safety/blocks`                                  | Manage blocked students                                  |
| `POST`                           | `/api/v1/safety/reports`                                 | Report a profile or a message                            |
| `GET`                            | `/api/v1/sessions/history`                               | List completed sessions and their notes                  |
| `POST`                           | `/api/v1/sessions/{session_id}/complete`                 | Mark a session as conducted                              |
| `PUT`                            | `/api/v1/sessions/{session_id}/outcome`                  | Save shared session notes and next steps                 |
| `GET`                            | `/api/v1/conversations`                                  | List authorized conversations                            |
| `POST`                           | `/api/v1/conversations/start`                            | Start a direct chat request with an introductory message |
| `GET`, `POST`                    | `/api/v1/conversations/{conversation_id}/messages`       | Read or send paginated messages                          |
| `POST`                           | `/api/v1/conversations/{conversation_id}/read`           | Mark conversation messages read                          |
| `DELETE`                         | `/api/v1/messages/{message_id}`                          | Delete the caller's own message                          |
| `GET`                            | `/api/v1/notifications`                                  | Read notifications                                       |
| `GET`                            | `/api/v1/notifications/unread-count`                     | Count unread notifications                               |
| `PATCH`                          | `/api/v1/notifications/{notification_id}/read`           | Mark one notification read                               |
| `POST`                           | `/api/v1/notifications/read-all`                         | Mark all notifications read                              |
| `GET`, `POST`                    | `/api/v1/sessions`                                       | List or create study sessions                            |
| `POST`                           | `/api/v1/sessions/{session_id}/invitation`               | Accept or decline an invitation                          |
| `DELETE`                         | `/api/v1/sessions/{session_id}`                          | Cancel a session as its owner                            |

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
src/App.tsx               React Router routes and page composition
src/main.tsx              React application entry point
server/index.mjs          Express static host and cookie-backed API proxy
src/components/           React auth, profile, discovery, groups, chat, sessions
src/lib/                  API clients, schemas, and shared types
vite.config.ts            Vite, React, Tailwind, and development API proxy
e2e/                      Playwright UI/API smoke tests
```

## Requirements and local setup (Windows PowerShell)

- Node.js 20.19+
- Python 3.12+
- PostgreSQL 15+
- npm and `psql`

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

4. Copy `.env.example` to `.env.local`, set the private PostgreSQL connection, and generate a random JWT secret:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Set the generated value as `JWT_SECRET_KEY`. Configure the remaining values as follows:

   ```dotenv
   DATABASE_URL=postgresql://study_buddy:your-password@localhost:5432/study_buddy
   JWT_SECRET_KEY=replace-with-generated-random-value
   API_URL=http://localhost:8000
   VITE_API_URL=http://localhost:8000
   FRONTEND_URL=http://localhost:1000
   CORS_ORIGINS=["http://localhost:1000","http://127.0.0.1:1000"]
   ```

   `DATABASE_URL`, `JWT_SECRET_KEY`, and `API_URL` are server-only. Do not prefix them with `VITE_`.

5. Start the API and frontend in separate terminals:

   ```powershell
   npm run api:dev
   npm run dev
   ```

6. Open `http://localhost:1000`. Registration creates the account and signs the student in immediately.

Registration accepts student addresses in the form `123456@astanait.edu.kz`, where the local part is exactly six digits. The app checks the address format but does not verify that the student owns the mailbox. Email-based password recovery is disabled.

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

Unit/API tests cover profile validation, match-score calculations, and rejection of unauthenticated API calls. Playwright covers the public UI, mobile overflow, client-side validation, and API auth rejection. Authenticated database workflows require a running PostgreSQL instance.

## Deployment and operational security

Deploy the React static build with the Express API proxy and FastAPI to trusted hosts, and keep PostgreSQL on a private managed or self-hosted database. Set `API_URL` and `FRONTEND_URL` on the Express server, `VITE_API_URL` to the reachable HTTPS API origin for WebSockets at build time, and set `DATABASE_URL`, `JWT_SECRET_KEY`, and CORS origins on FastAPI. Use HTTPS/WSS, TLS to PostgreSQL, secret rotation, backups, and a dedicated database role. Configure reverse-proxy trusted hosts carefully; never accept user identity from arbitrary forwarded headers.

## Current limitations

- PostgreSQL must be provisioned and the migration applied before persistent routes work.
- Messages use PostgreSQL `LISTEN/NOTIFY` over ticket-authorized WebSockets, with a polling fallback when the WebSocket endpoint is not reachable.
- Email ownership checks and email-based password recovery are unavailable without an outbound mail service.
- A private PostgreSQL deployment is an external setup requirement.
- Avatar upload, calendar provider integrations, and authenticated database-backed E2E fixtures are not included.
