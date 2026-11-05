# Backend Security Audit — Study Buddy

Audit date: 2026-11-04. Scope: the current working tree of `backend/app`, `backend/tests`, `migrations`, the Express ingress in `server`, and the included Docker/deployment configuration. This was a read-only source audit plus one isolated local proxy test. It did not connect to production, a real PostgreSQL instance, or a third-party service. Existing uncommitted application changes were preserved.

## Executive Summary

FastAPI uses signed, expiring, type-bound JWTs, Argon2 password hashes, a database-backed refresh-session check, Pydantic request models, parameterized SQL, and explicit membership checks in most sensitive paths. The query builder allowlists table and column names. These are meaningful protections; they do not establish complete production security without database and deployment tests.

The highest-priority defect is identity assurance: registration immediately marks an address verified and issues tokens without proving control of the six-digit university mailbox. A separate business-logic path allows a student to invite someone who has blocked them to a study session. The cookie-authenticated Express ingress accepts a foreign `Origin` when `FRONTEND_URL` is absent. WebSocket and file-upload designs also have credible resource-exhaustion paths; their availability impact needs isolated load validation. No confirmed SQL injection, SSRF, command execution, or unauthenticated protected-data read was established.

**Release assessment:** university-verified membership and the block feature should not be claimed as enforced until SEC-001 and SEC-002 are fixed. Cookie-authenticated deployments need SEC-003 fixed. Production readiness also depends on backend tests, a live authorization matrix check, dependency scanning, and deployment controls that could not be verified here.

## Architecture & Attack Surface

| Component | Trust boundary and security role |
| --- | --- |
| React browser and Express ingress | The browser calls `/api/auth/:action` and `/api/backend/api/v1/*` on the same origin. `server/app.mjs:60-89` stores bearer tokens in `HttpOnly`, `SameSite=Lax` cookies; `server/app.mjs:189-290` forwards authenticated requests to FastAPI. The Express raw-body limit is 20 MB (`server/app.mjs:19`). |
| FastAPI | `backend/app/main.py:28-47` mounts eight routers and CORS middleware. All application-data HTTP routes use the `CurrentUser` dependency; auth bootstrap/token endpoints and `/health` are public. Default FastAPI documentation paths are not disabled in the application constructor. |
| Authentication | `backend/app/auth.py:39-180,188-429` validates JWT signature/algorithm/type/expiry, checks an active refresh-session row, uses Argon2, hashes stored refresh tokens, and has subject-based auth throttling. Access tokens live 15 minutes by default; refresh tokens live 30 days (`backend/app/config.py:15-18`). |
| Data access | `backend/app/database.py:18-124,207-346` allowlists table/column names and builds per-user SQL predicates. `TableQuery` and RPCs use parameter values; raw SQL in endpoint handlers and RPCs must enforce their own access rules. There is no PostgreSQL RLS in the migrations, so application code and DB credentials are critical boundaries. |
| Collaboration | Connections, groups, conversations, sessions, goals, safety actions, files, and notifications are stored in PostgreSQL. `migrations/001_initial.sql` and `002_collaboration_features.sql` define constraints and several rate-limit triggers. No payment, administration, queue, Redis, webhook, OAuth, or outbound document-fetch integration was found. |
| Realtime | An authenticated HTTP call issues a random, hashed, 30-second, one-use WebSocket ticket (`backend/app/realtime.py:16-67`). The socket validates origin and conversation membership, then opens a dedicated PostgreSQL `LISTEN` connection (`backend/app/realtime.py:70-158`). |
| Deployment | Compose exposes the frontend on 1000 and FastAPI on host port 8002 (`docker-compose.yml:31-32,55-58`); the database has no host port mapping. Render config sets `CORS_ORIGINS` to `[*]` (`render.yaml:14-15`). TLS termination, firewall rules, host/proxy trust, runtime DB grants, and actual headers were not available for inspection. |

Sensitive flows: registration/login credentials enter FastAPI through Express; password hashes and token hashes enter PostgreSQL; JWTs return to Express and become `HttpOnly` cookies; Express turns the access cookie into an upstream `Authorization` header. Profiles, messages, session meeting details, group files, and reports are user data governed by FastAPI queries and application-level SQL policies. A browser-supplied group link is stored but is never fetched by the backend (`backend/app/collaboration.py:272-280`), so that path is not SSRF in the inspected code.

## Security Findings

### SEC-001 — Registration grants university-verified identity without mailbox proof

- **Severity / confidence:** High / Confirmed in source. **CWE:** CWE-287. **OWASP:** API2:2023 Broken Authentication. **CVSS v3.1:** not assigned; final impact depends on whether membership is restricted to real university students.
- **Affected component / location:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`; `backend/app/auth.py:226-259,262-292`; `backend/app/schemas.py:26-36,437-449`.
- **Root cause and attacker control:** `StudentEmail` validates the six-digit address *format*, but registration inserts `email_verified=true` and immediately issues JWTs. Login also promotes an unverified account to verified after a password check. An attacker controls an unused syntactically valid address and their own password; no mailbox challenge is required.
- **Prerequisites and scenario:** An outsider guesses an unused `######@astanait.edu.kz` address and registers first. The resulting account is marked verified and can complete onboarding and use authenticated student features. This can squat an address or impersonate its holder; it is not evidence of taking over an already-existing account.
- **Business impact:** University-only access and trust signals are not reliable. The exact data visible to a newly registered account requires a live PostgreSQL test.
- **Evidence:** The insert literal `true` at `auth.py:234-235`, immediate `_create_tokens` at line 259, and login update at lines 286-290. No email-sending code or token issuance exists on the registration path. The migration defaults `email_verified` to false (`migrations/001_initial.sql:1-10`), but the insert overrides that default.
- **Remediation:** Register a pending, unverified account; create a hashed, short-lived, single-use verification token; deliver it to the actual mailbox; and deny authenticated collaboration until the token is redeemed. If email delivery is intentionally unavailable, expose an unverified state and do not claim university identity. Preserve the exact six-digit email validation.
- **Verification:** Mock the mailer and database in a unit test; assert registration returns no signed-in session and stores `email_verified=false`. Test incorrect/expired/used token rejection and that password login cannot change verification state. Repeat with a real test database.

### SEC-002 — Blocked students can still send study-session invitations

- **Severity / confidence:** Medium / Confirmed control-flow gap in source; no live database run. **CWE:** CWE-841 (Improper Enforcement of Behavioral Workflow). **OWASP:** API6:2023 Unrestricted Access to Sensitive Business Flows. **CVSS v3.1:** not assigned without verified deployment behavior.
- **Affected component / location:** `POST /api/v1/sessions`, `backend/app/sessions.py:126-144`; `_create_study_session`, `backend/app/database.py:1235-1291`; block creation, `backend/app/collaboration.py:685-703`.
- **Root cause and attacker control:** The session RPC accepts invitees if they have an `accepted` connection with the organizer (`database.py:1245-1255`). It does not exclude either direction of `blocked_users`. Creating a block only inserts a block row; it does not change the accepted connection. The RPC then inserts an invitation and notification (`database.py:1272-1291`). In contrast, direct messaging explicitly checks blocks (`database.py:1013-1022`). An authenticated student controls the invitee IDs in the bounded request model (`backend/app/schemas.py:290-316`).
- **Prerequisites and scenario:** Two students were connected; one blocks the other. The blocked student submits a session invitation containing the blocker’s ID. The server-side condition still treats their accepted connection as sufficient and schedules a notification to the blocker. A daily session creation trigger limits volume to 10 per account (`migrations/001_initial.sql:370-390`), but does not enforce the block.
- **Business impact:** The block feature can be bypassed as a direct-contact boundary, allowing unwanted invitations and notifications.
- **Evidence:** Source trace above; no synthetic or live PostgreSQL execution was possible in this environment.
- **Remediation:** Apply the same two-way block predicate to the connected-invitee query, and recheck it in the transaction before writing participants/notifications. Decide whether existing pending invitations should be hidden or canceled when a block is created.
- **Verification:** In an isolated test database, create an accepted connection, block in each direction, and assert `POST /sessions` rejects the blocked invitee with no session or notification inserted. Check a normal accepted connection still works.

### SEC-003 — Cookie-authenticated proxy accepts foreign unsafe origins

- **Severity / confidence:** Medium / Confirmed proxy gate; full browser CSRF is conditional on site/cookie context. **CWE:** CWE-352. **OWASP:** API8:2023 Security Misconfiguration. **CVSS v3.1:** not assigned without a browser-and-hosting reproduction.
- **Affected component / location:** `server/app.mjs:33-57,132-135,213-255`.
- **Root cause and attacker control:** `isAllowedOrigin()` returns true for any syntactically valid origin when `FRONTEND_URL` is unset, accepts any `*.vercel.app` origin, and compares a forwarded host without a defined trusted-proxy boundary. After this check, the proxy attaches the victim’s bearer token to the upstream request. `SameSite=Lax` limits cross-site cookie sending but does not stop same-site cross-origin writes; CORS response blocking does not undo a simple request's side effect.
- **Prerequisites and scenario:** A victim is signed in and visits an attacker-controlled origin that the browser considers same-site with the app. A simple multipart POST can carry cookies to an allowed write endpoint. The attacker still needs endpoint-specific prerequisites, such as a group ID and the victim’s group membership, and the real browser/deployment path has not been tested.
- **Business impact:** State-changing API actions may be invoked under the victim's account where those prerequisites hold.
- **Evidence:** Isolated local `createApp({serveStatic:false})` test with a stubbed upstream, synthetic `study_access` cookie, `Origin: https://attacker.example`, and multipart `POST /api/backend/api/v1/groups/<synthetic-uuid>/materials`: proxy returned stubbed `201`, and the upstream stub received one call. No real JWT, database, or external network was used.
- **Remediation:** Fail closed on unsafe methods unless `Origin` exactly matches a configured trusted origin, including scheme and port. Remove the blanket Vercel suffix rule; trust forwarded host only through an explicitly configured proxy. Define a narrow absent-Origin policy and add CSRF tokens if that class of client must be supported.
- **Verification:** Unit-test same-origin acceptance and foreign, sibling-subdomain, arbitrary Vercel tenant, and spoofed forwarded-host rejection for JSON and multipart writes. Then verify with a real browser against an isolated deployment.

### SEC-004 — Each WebSocket holds a dedicated PostgreSQL connection

- **Severity / confidence:** Medium / Probable resource-exhaustion path; no controlled load test. **CWE:** CWE-400. **OWASP:** API4:2023 Unrestricted Resource Consumption. **CVSS v3.1:** not assigned without runtime limits.
- **Affected component / location:** ticket issuance and socket lifecycle, `backend/app/realtime.py:23-67,115-158`.
- **Root cause and attacker control:** The per-user ticket cap permits up to 120 tickets per hour (`realtime.py:32-41`). Each accepted socket independently calls `psycopg.AsyncConnection.connect` and keeps its own `LISTEN` connection open while sending heartbeats. There is no concurrent-socket cap per user or global bound in the inspected code. A student can create a group conversation and request tickets for it; each ticket is one-use, but many tickets can be used concurrently.
- **Prerequisites and scenario:** An authenticated student opens many valid sockets to a conversation they belong to and leaves them connected. This consumes many PostgreSQL connections and can crowd out normal API traffic if the database connection budget is lower than concurrent demand. The database's actual connection cap and edge controls were not measured.
- **Business impact:** Potential API and realtime availability loss.
- **Evidence:** Source trace above; 120/hour is a ticket-issuance limit rather than a concurrent connection limit. No production or uncontrolled load test was performed.
- **Remediation:** Share a bounded listener/notification fan-out per process or strictly cap active sockets against the database connection budget; enforce per-account and global concurrent limits and idle/max-lifetime controls. Keep membership rechecks and one-use tickets.
- **Verification:** In an isolated stack with a deliberately small PostgreSQL connection budget, open a bounded number of synthetic sockets and assert extra sockets fail cleanly while ordinary API requests still succeed. Do not test this against production.

### SEC-005 — Group-file storage has no aggregate quota or server-wide upload limit

- **Severity / confidence:** Medium / Probable resource-exhaustion path; no upload load test. **CWE:** CWE-400. **OWASP:** API4:2023 Unrestricted Resource Consumption. **CVSS v3.1:** not assigned without storage/edge limits.
- **Affected component / location:** `POST /api/v1/groups/{group_id}/materials`, `backend/app/collaboration.py:248-316`; `migrations/002_collaboration_features.sql:28-47`; ingress limits at `server/app.mjs:19` and `docker-compose.yml:31-32`.
- **Root cause and attacker control:** An authenticated group member can upload a file up to 5 MB, stored as PostgreSQL `bytea`. The handler checks a single file after multipart parsing and membership, but the inspected code has no per-user/group cumulative byte quota, upload rate limit, or direct FastAPI request-body cap. The 20 MB Express cap only applies when traffic goes through Express; Compose also exposes FastAPI directly on host port 8002. The migration checks individual stored files, not total storage.
- **Prerequisites and scenario:** A student creates or joins a group and repeatedly uploads permitted-size files. Database storage grows without an application-level aggregate limit. A much larger multipart request to the direct API may consume parser/temp-file resources before the handler's 5 MB read, depending on server and edge limits.
- **Business impact:** Potential database disk, memory, or request-processing exhaustion. The code does enforce per-file size and an extension allowlist; no destructive test was run.
- **Evidence:** Source and schema trace above. No storage consumption or multipart-parser behavior was measured in a live stack.
- **Remediation:** Add request-body limits at every public ingress, a transactional per-group/user storage quota, an upload rate limit, and bounded retention. Preserve the 5 MB per-file limit and download-only `Content-Disposition: attachment`, `nosniff`, and `no-store` (`collaboration.py:323-343`). Consider object storage if files grow beyond small, controlled volumes.
- **Verification:** In an isolated test stack, assert over-limit requests fail before full parsing, quota-exceeding uploads leave no file row, and allowed files still download only to members.

## Endpoint Security Matrix

All paths below are under `/api/v1` unless otherwise stated. “Observed check” describes source code; database-level behavior was not exercised live. There is no admin router in this repository.

| Endpoint(s) | Intended caller / role | Observed server-side check and concern |
| --- | --- | --- |
| `GET /health`; FastAPI default docs/OpenAPI paths | Public | Health returns a constant status (`backend/app/main.py:69-71`). Docs are not disabled in `FastAPI(...)`; whether the edge exposes them is unverified. |
| `POST /auth/register`, `/login`, `/forgot-password` | Public | Pydantic email/password schema; subject-based rate limit for register/login. Registration identity gap: SEC-001. Forgot-password returns 501. |
| `POST /auth/verify-email`, `/refresh`, `/logout`, `/reset-password` | Bearer of a valid purpose-specific token | JWT type/signature/expiry for refresh/logout; hashed, expiring, one-use DB token for verify/reset; reset revokes sessions. Public raw endpoints do not rely on cookies. |
| `GET /auth/me`; `GET/PUT /profile`; `GET /dashboard` | Authenticated student / own profile | `CurrentUser`; profile query targets `user.id`; profile upsert RPC uses the authenticated ID (`backend/app/profiles.py:28-40,105-136`). |
| `GET /discover`, `/students/{student_id}` | Authenticated student; visible/connected/shared profile, not blocked | Query-layer profile policy and discovery filters (`backend/app/database.py:210-253`; `backend/app/discovery.py:152-199,284-315`). `GET /discover` loads all candidates before page slicing; see resource follow-up below. |
| `GET/POST /connections`; `POST /connections/{id}/respond` | Authenticated requester/recipient | RPC binds requester to `user.id`, checks visibility and blocks; response requires addressee and pending status (`backend/app/database.py:720-844`). |
| `GET/POST /groups`; `GET/PATCH /groups/{id}`; `POST /groups/{id}/join`; `POST /groups/requests/{id}/respond`; `DELETE /groups/{id}/members/{student_id}` | Authenticated student; owner for settings/approvals/other-member removal | Group visibility predicate, `owner_id` filter, RPC membership/owner checks (`backend/app/groups.py:168-328`; `backend/app/database.py:1080-1233`). |
| `GET/POST /groups/{id}/tasks`; `PATCH/DELETE /groups/{id}/tasks/{task_id}` | Group member; creator/owner for management, assignee for status only | `_require_group_member`, task row locks, role checks, allowlisted update fields (`backend/app/collaboration.py:86-227`). |
| `GET/POST /groups/{id}/materials`; `GET /groups/{id}/materials/{material_id}/file`; `DELETE /groups/{id}/materials/{material_id}` | Group member; uploader/owner for delete | Membership and group-ID checks; file upload/resource concern: SEC-005 (`backend/app/collaboration.py:230-369`). |
| `GET/POST /groups/{id}/focus`; `POST /groups/{id}/focus/{focus_id}/finish` | Group member | Membership check; transaction advisory lock on starts (`backend/app/collaboration.py:372-464`). |
| `GET/POST/PATCH/DELETE /goals[/... ]`; `GET /progress` | Authenticated student / own goals | Raw SQL binds `user.id`, goal IDs, and parent IDs; update columns from a fixed map (`backend/app/collaboration.py:466-668`). |
| `GET/POST/DELETE /safety/blocks[/student_id]`; `POST /safety/reports` | Authenticated student / own block or report | Blocker is `user.id`; report of a message requires conversation membership (`backend/app/collaboration.py:670-767`). Session-invite path misses blocks: SEC-002. |
| `GET /conversations`; `GET/POST /conversations/{id}/messages`; `POST /conversations/{id}/read`; `POST /conversations/start`; `DELETE /messages/{id}` | Conversation member; author for delete; intro rules for pending direct chat | Conversation/message policies and RPC membership/block/intro-count checks (`backend/app/messaging.py:55-315`; `backend/app/database.py:293-325,846-1075`). |
| `GET /notifications`, `/notifications/unread-count`; `PATCH /notifications/{id}/read`; `POST /notifications/read-all` | Authenticated student / own notifications | Query predicate binds `user_id` (`backend/app/messaging.py:317-385`; `backend/app/database.py:326-327`). |
| `GET/POST /sessions`, `GET /sessions/history`; `POST /sessions/{id}/invitation`; `DELETE /sessions/{id}`; `POST /sessions/{id}/complete`; `PUT /sessions/{id}/outcome` | Authenticated participant/organizer; organizer for cancel/complete; accepted participant for outcome | Session/participant predicates and explicit owner checks (`backend/app/sessions.py:76-314`). Invitation creation omits blocked-user check: SEC-002. |
| `POST /conversations/{id}/ws-ticket`; `WS /ws/conversations/{id}` | Authenticated conversation member / one-use ticket holder | Ticket/member/origin checks (`backend/app/realtime.py:23-115`); DB-connection availability concern: SEC-004. |

## Vulnerability Evidence and Negative Checks

| Check | Expected / observed result | Evidence level |
| --- | --- | --- |
| Registration state | Expected for verified university access: mailbox proof before `email_verified=true`. Observed source: registration writes true and returns tokens; login also promotes false to true. | Confirmed code path; no live account created. |
| Blocked session invite | Expected: either direction of a block prevents a new direct invite. Observed source: session RPC checks only accepted connection and inserts invitation/notification. | Confirmed code path; no live DB result. |
| Foreign-origin proxy write | Expected: `403` before upstream. Observed in isolated Node test: synthetic foreign-origin multipart POST returned upstream-stubbed `201`; one upstream call occurred. | Confirmed isolated proxy behavior; real-browser cookie delivery unverified. |
| WebSocket connection budget | Expected: bounded active DB listeners. Observed source: one dedicated PG connection per accepted socket, with ticket issuance limited to 120/hour/user but no concurrency cap. | Probable availability risk; no load run. |
| File quota | Expected: total storage/request budget. Observed source: per-file 5 MB check, no cumulative quota or direct FastAPI body cap in repository. | Probable availability risk; no load run. |
| Injection review | Dynamic SQL identifiers in the query builder and task/goal updates are allowlisted; values use psycopg parameters (`backend/app/database.py:353-576`; `backend/app/collaboration.py:181-194,528-540`). No subprocess/eval, server-side URL fetch, XML parser, or unsafe deserializer was found. | Source review only; no injection exploit established. |
| Authorization review | Sensitive routes use `CurrentUser`, group/conversation/session paths check membership or owner. `backend/tests/test_profiles.py:45-69` covers unauthenticated access to only a subset of routes. | Source and test review; cross-account live DB tests absent. |

### Authentication, framework, and data-protection review

`jwt.decode` fixes the accepted algorithm to HS256 and requires `sub`, `type`, `exp`, and `iat` (`backend/app/auth.py:110-130`). Every protected HTTP request checks that the associated refresh-session row remains active and the account is not disabled (`auth.py:133-179`), so logout and password-reset revocation have an immediate authorization path. Login creates a fresh session ID; no session-fixation path was identified. Password reset and email verification tokens are compared by hash, expiry, and used state under a row lock (`auth.py:295-318,386-413`). No OAuth, OTP, or SMS flow exists. The forgot-password endpoint returns 501, so user-facing recovery is unavailable in this build.

The refresh endpoint returns the same bearer refresh token after use (`auth.py:320-363`); a stolen token can therefore be replayed until expiry or explicit revocation. The token is kept in an `HttpOnly` proxy cookie in the intended browser flow, and no theft route was found in this audit. Treat rotation/reuse detection as a defense-in-depth improvement rather than a confirmed account-takeover finding. Login gives a generic bad-password error, while registration's duplicate-address conflict can reveal whether an address has an account (`auth.py:248-252`); this is a limited enumeration signal, not a login bypass.

Pydantic models constrain email format, UUID IDs, string lengths, dates, enums, and list sizes; some write models use `extra="forbid"` (`backend/app/schemas.py`). Return models restrict several read responses; raw-dict endpoints generally select explicit columns. The dynamic SQL paths reviewed use fixed identifier maps and bound values, and the migration's dynamic trigger names come from a hardcoded table list (`migrations/001_initial.sql:267-283`). There is no outbound HTTP fetch of user-provided links, shell command, template execution, XML parser, or unsafe deserializer in `backend/app`. File downloads send attachments with `nosniff` and `no-store` (`backend/app/collaboration.py:323-343`). These negative checks are limited to the inspected source, not proof that external infrastructure is safe.

FastAPI has a default public OpenAPI/docs surface and no `TrustedHostMiddleware` or HTTPS redirect in `backend/app/main.py`; an edge may supply those controls. `render.yaml` permits wildcard CORS, but the backend uses bearer headers rather than browser cookies, so wildcard CORS alone is not evidence of cross-user data access. The WebSocket handler's exact origin check conflicts with that wildcard value. The database pool wraps operations in transactions and sets `app.user_id` (`backend/app/database.py:140-192`), but the application does not enable PostgreSQL RLS; raw SQL and the runtime DB role must remain restricted and tested.

## Remediation Roadmap

1. **Identity assurance, before claiming verified membership (1–3 engineering days plus mail-provider integration):** replace immediate verification with a pending account and one-use email challenge. Example root-cause comparison:

   ```python
   # Before: the insert overrides the database's false default.
   "... values (%s,lower(%s),%s,%s,true)"
   return _create_tokens(user_id, request.email.lower())

   # After: persist an unverified account and deliver a one-use challenge.
   "... values (%s,lower(%s),%s,%s,false)"
   issue_verification_challenge(user_id, request.email)
   return RegistrationPending()
   ```

   The example is schematic: the mailer, token table transaction, 202 response, frontend pending state, resend flow, and failure handling require implementation. Do not change only the database flag while retaining login's promotion at `auth.py:286-292`. Regression risk: current immediate onboarding flow will change.

2. **Block policy across direct-contact flows (0.5–1 day):** add a two-way `blocked_users` exclusion inside `_create_study_session`'s accepted-connection query. Before: accepted connection alone authorizes an invite. After: accepted connection **and no block in either direction** authorize it. Keep this check in the same transaction as participant/notification writes; test both block directions and an ordinary invite. Regression risk: previously allowed invites to blocked users will be rejected by design.

3. **Proxy origin gate (0.5–1 day):** replace the final permissive `return true` and `*.vercel.app` shortcut in `server/app.mjs:33-57` with an exact trusted-origin set and a trusted-proxy policy. Example:

   ```js
   // Before
   return true;
   // After, for an unsafe browser request
   return trustedOrigins.has(new URL(origin).origin);
   ```

   Test JSON and multipart writes, same-origin requests, absent-Origin clients, and preview-domain policy. Regression risk: integrations relying on permissive origins will need explicit allowlisting.

4. **Realtime connection budget (1–2 days plus isolated load test):** bound active sockets per account and globally, share or pool PostgreSQL notification listeners, and set lifecycle limits. Preserve one-use tickets and membership rechecks. Test against a small PG connection budget; do not run the test on production.

5. **Upload budget (1–2 days plus isolated test):** enforce body limits at the final API edge and FastAPI route, add aggregate byte/count quotas and rate limits before database insertion, and define retention. Preserve member-only downloads and attachment headers. Test quota rollback and oversized multipart rejection.

6. **Follow-up performance controls (estimate after profiling):** `GET /discover` calls `_fetch_all()` on all matching profiles before scoring and slicing to `page_size` (`backend/app/discovery.py:30-38,178-245`); no request-level rate limit is visible. Auth throttling keys each attempt to the email/token subject only (`backend/app/auth.py:188-223`), so distinct subjects are not globally bounded. These are unmeasured resource risks; profile with synthetic data and define edge/account budgets before treating them as confirmed denial-of-service vulnerabilities.

## Security Test Coverage

| Test or tool | Result |
| --- | --- |
| Repository source review | Inspected all `backend/app` modules, four backend test modules, three SQL migrations, Express proxy, and Docker/Render configuration. No application source was modified. |
| Isolated Node proxy test | Passed as a *reproduction of the defect*: foreign-origin multipart request with a synthetic cookie reached a stub upstream once and returned `201`. No real credential or database was involved. |
| `node --check server/app.mjs` | Passed. |
| `npm.cmd run api:test` and `npm.cmd run api:lint` | Could not run: `python` is not on PATH; `py -0p` reports no installed Pythons. The `.venv` from the prior frontend audit points at a missing interpreter. No tests are reported as passed. |
| Docker/PostgreSQL | Not run. `docker info` could not connect to a daemon; it also reported unreadable local Docker config. Migration behavior and transaction-level authorization remain unverified. |
| Bandit, Semgrep, pip-audit, Gitleaks, ZAP | Not run. No installation or network-based scan was performed, as requested. Known-vulnerability status of pinned/resolved Python packages is unverified. |

Existing tests cover JWT type/expiry, Argon2, schema shape, SQL identifier allowlisting, some user predicates, and selected unauthenticated routes (`backend/tests`). They do not exercise registration email proof, blocked invites, WS connection budgets, aggregate file quota, multi-user authorization, or a live database. The checked `backend/pyproject.toml` uses version ranges rather than a fully locked Python dependency set; no advisory conclusion is possible without a permitted dependency scan.

## Production Hardening Checklist

- Configure an exact frontend-origin allowlist at Express and FastAPI; test the final CORS and WebSocket behavior. `render.yaml:14-15` sets `CORS_ORIGINS=["*"]`, while the WebSocket handler requires exact membership in that list (`backend/app/realtime.py:76-79`), so that config may reject legitimate realtime origins.
- Terminate HTTPS at a trusted edge, use WSS, set HSTS/security headers there, and verify `Secure` cookie flags on public responses. No live deployment headers were inspected.
- Keep PostgreSQL private, use a least-privilege runtime role separate from schema migration ownership, and restrict direct FastAPI exposure where the Express proxy is the intended cookie boundary. Compose uses the same configured DB account for bootstrap and application traffic and publishes FastAPI on port 8002 (`docker-compose.yml:4-32`). The actual network and database grants were not checked.
- Replace development fallback credentials in deployment configuration; rotate and inject `JWT_SECRET_KEY` and database credentials through a secret manager. `.env` files were not read; `git ls-files` found no tracked `.env` or `.env.local` files.
- Add structured security events and retention for auth failures, registration, revocation, blocks, uploads, and rate-limit decisions without logging passwords, tokens, raw file contents, or unnecessary PII. Review `database_connection` exception logging (`backend/app/database.py:181-192`) for sensitive database detail before enabling verbose production logs.
- Pin and review Python dependency versions, run an authorized advisory scan, and rebuild images from supported patched bases. `backend/Dockerfile` uses `python:3.12-slim`, installs test extras in the runtime image, and does not switch to a non-root user; these are hardening items, not evidence of exploitation.
- Run migrations through a controlled release process with backups; the Compose entrypoint migration mount only applies on first database initialization. Verify database version, roles, and data before changing the persistent volume.
- Add isolated PostgreSQL tests for each ownership/membership boundary, including direct-ID requests, role transitions, block interactions, concurrent requests, one-use tokens, and file downloads. Check final-edge request-size, connection, and rate limits.

## Final Assessment

The inspected backend has substantial baseline protections, especially JWT/session validation, SQL parameterization, Pydantic boundaries, and explicit membership checks. It is **not ready to be represented as enforcing verified university identity**. The blocked-invite bypass and proxy origin policy need fixes before a security-sensitive release. The WebSocket and upload resource paths need bounded runtime validation. Because Python, Docker/PostgreSQL, production configuration, and dependency scans were unavailable, this report does not certify the deployed system or claim successful end-to-end exploitation of source-only findings.
