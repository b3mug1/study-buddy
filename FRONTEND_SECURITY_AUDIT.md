# Frontend Security Audit — Study Buddy

Audit date: 2026-11-03. Scope: the current working tree of the React/Vite client, Express API proxy, and the FastAPI code needed to check browser-to-server trust boundaries. This is a source and isolated-local-test assessment, not a production penetration test. Existing uncommitted UI changes were present before the audit and were not edited.

## Executive summary

The app keeps access and refresh JWTs in `HttpOnly`, `SameSite=Lax` cookies set by the Express proxy; the browser calls same-origin `/api` routes. FastAPI uses bearer authentication and has user-scoped query predicates. The reviewed React rendering paths do not show a confirmed XSS sink.

Three concrete issues need action: registration grants a verified account without proving control of the university mailbox; the proxy accepts unsafe requests from an arbitrary `Origin` in the absence of `FRONTEND_URL`; and personal notes use a full name rather than an account ID as their local-storage namespace. The first is a cross-stack identity issue visible through frontend registration, and the second is a proxy/CSRF issue. Security response headers are also absent in the tested direct Express static-server configuration; headers on any upstream CDN or reverse proxy remain unverified.

**Deployment judgment:** do not treat the site as university-identity-verified until mailbox ownership is enforced. Fix the proxy origin check before exposing cookie-authenticated writes to browsers. Check production headers and the complete dependency graph before release.

## Technology and architecture

| Layer | Observed implementation |
| --- | --- |
| Browser | React 19.3, React Router 8.5 declarative `BrowserRouter`, TypeScript, Vite 8.3.5; entry `src/main.tsx`, routes `src/App.tsx:402-445`. |
| State | Component state and React context. Theme and notes use `localStorage`; splash state uses `sessionStorage`; locale uses a non-auth cookie. No Redux, Zustand, React Query, or IndexedDB usage was found. |
| Authentication | `src/components/auth/auth-forms.tsx:22-53` calls `/api/auth/:action`. `server/app.mjs:60-89` sets `HttpOnly` access/refresh cookies. `server/app.mjs:189-290` attaches a bearer token to upstream requests and refreshes on 401. FastAPI checks token signature, type, expiry, active session, and enabled user in `backend/app/auth.py:111-179`. |
| API | `src/lib/api-client.ts:28-74` uses `fetch`, `credentials: same-origin`, `cache: no-store`. Vite dev proxy forwards `/api` to Express on port 1001; production Express can serve `dist`; `api/index.mjs` exports Express for Vercel. |
| Realtime | `src/components/workspace/messages-page.tsx:234-253` requests a 30-second WebSocket ticket and puts it in the WS query. FastAPI checks origin, consumes the ticket once, and rechecks conversation membership (`backend/app/realtime.py:23-115`). `VITE_API_URL` is public build configuration for this connection. |
| Data | FastAPI/PostgreSQL; table access predicates in `backend/app/database.py:207-340`. PostgreSQL RLS is not enabled per `README.md:25`, so these backend checks are the authorization boundary. |

Frontend inventory: `src/components/auth` contains login, registration, reset, and verification forms; `src/components/profile` contains onboarding and profile editing; `src/components/app` supplies the authenticated layout, navigation, and search; `src/components/workspace` supplies dashboard, notes, discovery, connections, groups/collaboration, messages, sessions, progress, notifications, safety, and student profile pages. Shared UI/motion components live in `src/components/ui`, `motion`, and `navigation`. `src/lib` holds API types/client, i18n context, profile schema, and local notes. There is no separate global store or HTTP interceptor.

The repository has no Next.js Server Components or Server Actions in the active frontend architecture. The `.next` directory is generated/ignored and was not used as evidence of a Next.js runtime. The browser build is public by design; hiding a route or control is not authorization.

## Attack surface map and authentication/authorization matrix

| Browser route(s) | Intended access | Server-side checks observed / required |
| --- | --- | --- |
| `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/verify` | Public | Auth endpoints are separately proxied; reset/verify require valid one-use tokens. `/forgot-password` is currently unavailable. |
| `/onboarding` | Signed-in student without completed profile | Route checks `/profile`; `PUT /profile` uses `CurrentUser` and a schema (`backend/app/profiles.py:105-111`). |
| `/dashboard`, `/progress`, `/sessions`, `/notifications`, `/safety` | Signed-in student; own data and authorized participants | `AppLayout` checks `/profile` (`src/components/app/app-layout.tsx:29-47`). Backend uses `CurrentUser`; scoped predicates cover sessions, notifications, and profiles (`backend/app/database.py:207-340`). Runtime PostgreSQL enforcement was not tested. |
| `/notes` | Signed-in student; personal browser data | `AppLayout` gate only. Notes have no backend authorization and use a browser-local namespace; see FRONT-SEC-003. |
| `/my-profile`, `/settings/profile` | Signed-in profile owner | `GET/PUT /profile` bind to authenticated user (`backend/app/profiles.py:28-40,105-111`). |
| `/discover`, `/profile/:id`, `/connections` | Signed-in student; visibility, connection, and block restrictions | Backend discovery/profile queries and table predicates apply (`backend/app/discovery.py:152-199,284-315`; `backend/app/database.py:210-262`). |
| `/groups`, `/groups/:id` | Signed-in student; public group visibility or membership | Group update checks `owner_id` (`backend/app/groups.py:243-275`); collaboration materials/tasks require group membership (`backend/app/collaboration.py:41-54,86-109,230-255`). Join/remove RPC authorization needs a live database test. |
| `/messages`, `/messages/:id`, `/messages/new/:studentId` | Signed-in student; conversation member | Message list checks conversation visibility and the query layer checks membership (`backend/app/messaging.py:182-215`; `backend/app/database.py:293-325`). Message-write RPC authorization needs a live database test. |

No administrative frontend route was found. Parameter IDs are browser-controlled; FastAPI parses them as UUIDs and must continue to enforce ownership/membership on every endpoint. Browser route guards provide navigation behavior only.

External/browser surfaces: Google Fonts stylesheets in `index.html:12-17`; user-added HTTP(S) group links in `src/components/workspace/group-collaboration-panel.tsx:582-590`; file upload/download in that component and `backend/app/collaboration.py:248-343`; WebSocket URL/ticket; local notes; public JS chunks. The group-link API restricts schemes to HTTP(S) (`backend/app/collaboration.py:272-280`), and links open with `rel="noreferrer"`. Downloads use an object URL, revoke it, and the backend sends `Content-Disposition: attachment`, `nosniff`, and `no-store`.

## Vulnerability findings

### FRONT-SEC-001 — University mailbox ownership is not verified

- **Severity / confidence:** High / Confirmed in source; live registration was not run. **CWE:** CWE-287 (Improper Authentication). **OWASP:** A07:2021 Identification and Authentication Failures. **CVSS:** not assigned because the practical impact depends on whether university identity is a deployment requirement.
- **Affected component and location:** Registration and sign-in, `backend/app/auth.py:226-259,262-292`; university-address validation, `backend/app/schemas.py:26-36,437-449`; client registration, `src/components/auth/auth-forms.tsx:55-63`.
- **Root cause / trust boundary:** The six-digit address format is validated, but registration inserts `email_verified=true` and immediately issues tokens. Login also changes an unverified account to verified after a correct password. Neither path proves control of the address. The frontend can therefore treat a syntactically valid identity as verified.
- **Prerequisites / scenario:** An outsider knows or guesses an unused six-digit student address and registers it with their own password. They gain a signed-in, marked-verified account and can attempt the student workflows. This does **not** prove takeover of an existing account; it can squat an unused address and impersonate its owner.
- **Impact:** Integrity of university-only membership and possible exposure of data available to any registered student. The exact access breadth requires a live PostgreSQL test.
- **Evidence:** The insert literal `true` at `backend/app/auth.py:234-235`, immediate `_create_tokens` at line 259, and login update at lines 286-290. Backend validation at `backend/app/schemas.py:26-29` checks format only.
- **Recommended fix / regression test:** Set `email_verified=false`, issue a single-use confirmation link through a trusted mail provider, and grant authenticated social access only after a consumed verification token. If email delivery remains disabled, mark accounts unverified and do not claim university ownership. Test that registration and password login do not promote an unverified account; test that only a valid, unexpired, one-use token does.

### FRONT-SEC-002 — Proxy origin guard permits foreign unsafe requests

- **Severity / confidence:** Medium / Confirmed for the proxy check; end-to-end browser CSRF is conditional on cookie site context and a valid authenticated request. **CWE:** CWE-352 (CSRF). **OWASP:** A01:2021 Broken Access Control. **CVSS:** not assigned without browser-and-deployment verification.
- **Affected component and location:** `server/app.mjs:33-57,132-135,213-218`.
- **Root cause / trust boundary:** `isAllowedOrigin()` returns `true` for every syntactically valid foreign origin when `FRONTEND_URL` is unset. It also accepts any `*.vercel.app` host and compares a request-controlled forwarded host without a trusted-proxy boundary. The proxy attaches the user's bearer token to accepted writes (`server/app.mjs:228-255`). `SameSite=Lax` reduces cross-site cookie delivery, but does not protect same-site cross-origin requests (for example, a compromised sibling subdomain). CORS response restrictions do not undo a simple request's side effect.
- **Prerequisites / scenario:** A victim is signed in and visits an attacker-controlled origin that the browser regards as same-site with the app. A simple `multipart/form-data` POST to a permitted write endpoint can carry the victim's cookie and be forwarded. A valid group ID and group membership are still needed for the material-upload example. Browser behavior and actual hosting domains have not been tested.
- **Impact:** Unauthorized state-changing requests under the victim's session in affected deployments.
- **Evidence:** Isolated local Express test with a stubbed upstream: `Origin: https://attacker.example`, synthetic `study_access` cookie, `POST /api/backend/api/v1/groups/<synthetic-uuid>/materials`, and multipart body returned upstream `201`; the stub saw the POST. A separate synthetic `PUT /profile` with a foreign origin was forwarded and returned upstream `204`. No real token, database, or production service was used.
- **Recommended fix / regression test:** Use an explicit, exact allowlist of trusted *origins* (scheme, host, port), fail closed when it is missing, and trust forwarded headers only from configured reverse proxies. Reject unsafe requests with a mismatched `Origin`; decide a narrow policy for absent `Origin` and add a CSRF token if clients must support such requests. Test same-origin acceptance and foreign, sibling-subdomain, arbitrary Vercel tenant, and spoofed forwarded-host rejection, including a simple multipart write.

### FRONT-SEC-003 — Local notes are separated by full name, not account identity

- **Severity / confidence:** Low / Confirmed from source; a two-account browser test was not run. **CWE:** CWE-200 (Exposure of Sensitive Information). **OWASP:** A01:2021 Broken Access Control. **CVSS:** not assigned because exploitation requires a shared browser profile and matching name.
- **Affected component and location:** `src/components/workspace/notes-page.tsx:18-24,32-40`; `src/components/app/app-layout.tsx:75-78`; `src/lib/study-notes.ts:20-24,57-81`.
- **Root cause / trust boundary:** The storage helper's `ownerId` is populated from `profile.full_name`, not an immutable user ID. Two accounts with the same name in one browser profile read and overwrite the same `study-buddy:notes:<name>` value. Notes remain in local storage after logout.
- **Prerequisites / scenario:** Two users sign into the same browser profile and have the same full name, or one user changes their profile name to another user's. The second user can see or alter the first user's locally stored notes. This does not create remote access to notes.
- **Impact:** Local confidentiality/integrity loss for personal study notes; name changes can orphan notes.
- **Evidence:** `ownerId = profile?.full_name` at `notes-page.tsx:21`; `storageKey(ownerId)` at `study-notes.ts:23-24`; `loadNotes`/`saveNotes` at lines 57-81.
- **Recommended fix / regression test:** Use the stable `auth/me` user ID as the local namespace, or move notes to an authenticated server API if cross-device persistence is needed. Migrate old name-keyed notes only after tying them to a verified account; avoid silently assigning ambiguous shared-name data. Test two synthetic accounts with identical names and logout/login transitions.

### FRONT-SEC-004 — Direct Express static responses lack security headers

- **Severity / confidence:** Low / Confirmed for the isolated direct Express server; production deployment headers unverified. **CWE:** CWE-693 (Protection Mechanism Failure). **OWASP:** A05:2021 Security Misconfiguration. **CVSS:** not assigned; this is defense in depth.
- **Affected component and location:** `server/app.mjs:296-307`, `index.html:10`, `vercel.json:1-15`.
- **Root cause / trust boundary:** The direct static server sets no CSP, frame restriction, HSTS, or `X-Content-Type-Options` on HTML. `index.html` sets a referrer meta policy, and the download API sets `nosniff`; these do not cover all page responses. A CDN/reverse proxy may add headers, but its live configuration was not available.
- **Prerequisites / scenario:** The app is served directly from this Express process without equivalent upstream headers. The missing frame restriction can permit embedding; missing CSP removes a mitigation if a separate injection is introduced. No current XSS exploit was found.
- **Impact:** Reduced browser-side protection, especially clickjacking resistance and XSS containment.
- **Evidence:** Isolated `GET /` against `createApp({serveStatic:true})` returned no `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, or `X-Content-Type-Options` headers.
- **Recommended fix / regression test:** Set a tested CSP and `frame-ancestors 'none'` or an approved framing policy, `nosniff`, appropriate `Referrer-Policy`, and HTTPS-only HSTS at the final TLS terminator. Account for Google Fonts and Vite's generated scripts in CSP. Assert the headers on the real deployed HTML response.

## XSS, API, file, and sensitive-data review

Source-to-sink searches over `src`, `server`, and `backend/app` found no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, dynamic script injection, `postMessage`, or iframe use. API text, notes, messages, and notification content are placed into React text nodes, which React escapes. The group URL is used as an anchor `href`, but the backend limits it to HTTP(S); this is a trust boundary that should remain covered by tests. User-controlled route IDs become API path segments and are parsed as UUIDs at FastAPI endpoints. No confirmed reflected, stored, or DOM XSS path was established.

## Sensitive data exposure analysis

The browser does not store JWTs in `localStorage` or `sessionStorage`. Auth cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when Express runs in production mode (`server/app.mjs:60-89`). The server returns `Cache-Control: no-store` for auth/proxied API responses (`server/app.mjs:175-185,275-290`). The dedicated `VITE_API_URL` is public, as all `VITE_*` variables are. `.env` and `.env.local` are ignored by Git; `git ls-files` reported neither as tracked. The build emitted no `.map` files. This review did not read or reproduce any secret value, and it cannot prove that a separate production build or host is free of secrets.

File handling: the browser's file picker is convenience only. FastAPI limits uploads to 5 MB and allows listed filename extensions (`backend/app/collaboration.py:18-35,282-296`), checks group membership on upload and download, and sends downloads as attachments with `nosniff` and `no-store`. File contents are not signature-validated; keep them download-only and consider malware/content checks if files will later be previewed or served inline. The Express raw-body cap is 20 MB (`server/app.mjs:18`). External group links are attacker-supplied content even after HTTP(S) validation; users should treat destinations accordingly.

Session behavior: logout asks the backend to revoke the refresh session and clears proxy cookies (`backend/app/auth.py:365-375`; `server/app.mjs:148-149,178-181`). FastAPI checks refresh-session status on protected calls. Multiple tabs are not actively synchronized, so another open tab may show already-rendered data until its next API request/navigation. This is an unverified residual-display concern, not evidence that revoked tokens remain valid.

## Browser security assessment

The direct Express HTML response lacks the headers in FRONT-SEC-004. The final deployment may add them; that must be measured at its public URL. `index.html:10` has a strict-origin-when-cross-origin referrer policy, limiting cross-origin referrer detail from password-reset and verification URLs. The proxy's `HttpOnly`, `Secure` (production), and `SameSite=Lax` cookie options are in `server/app.mjs:60-89`; real deployment flags and TLS termination were not observed. There is no service worker, iframe, or `postMessage` handling in the reviewed frontend. The frontend calls relative `/api` URLs, while WebSocket uses a build-time URL; production must use HTTPS/WSS and an exact allowed origin. `render.yaml:14-15` sets `CORS_ORIGINS=["*"]`, whereas the WebSocket endpoint compares the `Origin` to list entries exactly (`backend/app/realtime.py:76-79`); this configuration should be tested for realtime availability and tightened to actual frontend origins.

## Dependency and supply-chain assessment

`package-lock.json` pins resolved dependency versions and integrity hashes. The build uses official Vite React/Tailwind plugins; `index.html` loads Google Fonts CSS, with no observed third-party executable script tag. The project uses `npm ci` in Docker (`Dockerfile:4-5,21-22`). No dependency was upgraded during this audit.

`npm audit --json --omit=dev` was attempted but the npm advisory endpoint returned an error, so **the dependency graph has not received a complete advisory scan**. A targeted review of primary advisories found that the cited React Server Components RCE affects `react-server-dom-*`, which this Vite SPA does not install or execute ([React advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3)); a React Router v7 Framework Mode RCE advisory excludes declarative `BrowserRouter` apps, and this project uses v8.5 declarative routing ([React Router advisory](https://github.com/advisories/GHSA-49rj-9fvp-4h2h)); and a Vite custom-middleware advisory covers through 8.3.2 while the build here used 8.3.5 ([Vite advisory](https://github.com/advisories/ghsa-9jrq-w75r-8gcw)). These checks do **not** establish that all direct or transitive packages are vulnerability-free. Re-run `npm audit --json` with registry access and triage each result by installed version and reachable usage.

## Security test results and limits

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd test` | Passed: 1 test file, 4 tests. These are profile-schema tests, not a full security suite. |
| `npm.cmd run build` | Passed; Vite 8.3.5 built 2,215 modules. No source maps emitted in `dist`. |
| Isolated proxy tests | Confirmed foreign-origin writes are forwarded with a synthetic cookie; confirmed direct static response header gaps. Upstream was stubbed; no real API or database was contacted. |
| `npm.cmd audit --json --omit=dev` | Blocked: npm registry advisory endpoint error. |
| `npm.cmd run api:test`, `npm.cmd run api:lint` | Blocked: `python` is not on PATH; `.venv/Scripts/python.exe` points to a missing Python installation. |
| Live PostgreSQL/Docker, real browser CSRF, WebSocket, deployment headers | Not run. Source checks must not be read as runtime proof. |

## Remediation roadmap

1. **Before claiming verified university membership (about 1–3 days plus mail-provider setup):** implement mailbox verification and prevent unverified sign-in/social access. Root-cause change:

   ```python
   # Before: registration grants verified status and issues a session.
   values (%s, lower(%s), %s, %s, true)
   return _create_tokens(user_id, request.email.lower())

   # After: keep a pending account; issue a one-use, expiring email link.
   values (%s, lower(%s), %s, %s, false)
   send_verification_link(user_id, request.email)
   return RegistrationPending()
   ```

   This changes the registration flow: the frontend needs a pending-verification state, resend behavior, and a failed/expired-link path. Test the backend state transition and the UI route.

2. **Before exposing cookie-authenticated writes (about 0.5–1 day):** make the proxy's allowed-origin list explicit and exact, including scheme and port; reject all other unsafe request origins. Root-cause change:

   ```js
   // Before: every valid foreign origin passes if FRONTEND_URL is unset.
   return true;

   // After: default-deny and match a configured trusted origin.
   return trustedOrigins.has(new URL(origin).origin);
   ```

   Define a trusted-proxy/host policy and test multipart writes, absent-Origin requests, and deployment previews. Avoid treating every `*.vercel.app` site as trusted.

3. **Protect local notes (about 0.5–1 day):** namespace by authenticated immutable user ID. For example, use `const {id} = await authenticatedApiJson<{id:string}>("auth/me")` and `storageKey(id)` instead of `storageKey(profile.full_name)`. Loading state and a careful migration are needed; two same-name accounts must never see each other's notes.

4. **Before release (about 0.5 day plus deployment verification):** set browser security headers at the final server/TLS edge, measure them on the deployed URL, and run a complete dependency audit. Configure CSP based on the built page's actual resource requirements. Verify HTTPS/WSS and cookie `Secure` attributes on the deployed host.

   ```js
   // Before: static responses have no browser-security middleware.
   app.use(express.static(staticDirectory, { index: false }));

   // After: apply tested headers before the static handler.
   app.use((_request, response, next) => {
     response.set("X-Content-Type-Options", "nosniff");
     response.set("Content-Security-Policy", "frame-ancestors 'none'");
     next();
   });
   app.use(express.static(staticDirectory, { index: false }));
   ```

   This example only covers framing and MIME sniffing; define the remaining CSP directives against real built assets and place HSTS at the HTTPS terminator. Test headers on direct Express and final deployment responses.

After these changes, re-run the existing checks and add targeted regression tests. A live PostgreSQL test should exercise unauthorized direct navigation/API calls across user IDs, group roles, conversation membership, file downloads, and revocation. No finding in this report claims that a client-side guard alone provides server authorization.

## Production readiness assessment

University-only access is blocked on a mailbox-verification decision and implementation. Cookie-authenticated writes are blocked on a strict origin/CSRF policy. Local-note separation should be repaired before promising private notes on shared devices. Release verification also needs deployed response-header/TLS checks, a successful complete dependency audit, and live backend authorization tests against PostgreSQL. The passing TypeScript, lint, unit-test, and build checks establish code health only; they do not resolve these security gates.
