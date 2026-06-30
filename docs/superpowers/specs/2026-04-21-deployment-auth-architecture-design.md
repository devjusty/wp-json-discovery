# Deployment & Auth Architecture Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Deploy WP JSON Discovery to production-ready hosting (Netlify + Render.com) with Auth0-backed authentication, per-user data ownership, admin/standard user roles, and stricter anonymous rate limiting.

**Architecture:** Maintain the existing two-service split (static Vite/React frontend + separate Express API). Add Auth0 authentication to the frontend/API boundary. Expand the existing Turso/libSQL schema for user records, scan ownership, and user notes. Rate limiting differentiates unauthenticated, standard, and admin users.

**Tech Stack:** Vite + React 19 (frontend), Express 5 (API), Turso/libSQL (database), Auth0 (auth), Netlify (frontend host), Render.com (API host).

---

## Data Model (Turso Schema Additions)

All existing tables (`scan_domains`, `scan_runs`, `unsupported_plugins`, `unsupported_plugin_domains`, `plugin_registry`, `theme_registry`, `activity_logs`) remain unchanged.

### New: `users` table

Stores Auth0-authenticated user records. The primary key is the Auth0 `sub` claim (a stable identifier like `auth0|xxxxx`).

| Column       | Type    | Constraints                |
|--------------|---------|----------------------------|
| id           | text    | primary key                |
| email        | text    | not null                   |
| display_name | text    | not null default ''        |
| role         | text    | not null default 'standard' (check `'standard'` or `'admin'`) |
| created_at   | text    | not null (ISO 8601)        |

- `role` is a string enum: `'standard'` or `'admin'`.
- Users are auto-vivified on first login (the auth middleware creates a row if `id` is not found, defaulting to `standard` role). Admin users are promoted manually via the API or direct DB write.

### New: `scan_ownership` table

Maps a scanned domain to a specific user, enabling "my scans" views.

| Column   | Type    | Constraints                                       |
|----------|---------|---------------------------------------------------|
| id       | integer | primary key autoincrement                         |
| user_id  | text    | not null references users(id) on delete cascade   |
| domain   | text    | not null references scan_domains(domain)          |
| saved_at | text    | not null (ISO 8601, when user saved/claimed it)   |
| notes    | text    | nullable                                          |
| unique(user_id, domain) | |                                                   |

- A scan result is only linked to a user when they explicitly save/claim it (anonymous scans do not create ownership records).
- `notes` allows a user to annotate a domain.

### New: `user_notes` table

General-purpose user notes attached to domains (separate from the scan_ownership notes field, for multiple annotations).

| Column     | Type    | Constraints                                     |
|------------|---------|-------------------------------------------------|
| id         | integer | primary key autoincrement                       |
| user_id    | text    | not null references users(id) on delete cascade |
| domain     | text    | not null                                        |
| note_text  | text    | not null                                        |
| created_at | text    | not null (ISO 8601)                             |
| updated_at | text    | not null (ISO 8601)                             |

## Auth Flow

1. **Frontend**: `@auth0/auth0-react` SDK wraps the app. Login/logout use Auth0 Universal Login. On mount, the SDK silently gets or refreshes the access token via `getAccessTokenSilently()`.

2. **Token**: The access token contains a custom claim for role (e.g., `https://wp-json-discovery/roles`) retrieved from Auth0's app_metadata. The frontend attaches it as `Authorization: Bearer <token>` on all API calls to the Express server.

3. **Backend middleware**: A new Express middleware `requireAuth` validates the Bearer token:
   - Fetches the Auth0 JWKS (`https://{domain}/.well-known/jwks.json`) to verify the token signature.
   - Extracts `sub`, `email`, and the custom role claim.
   - Auto-vivifies the user in Turso (`users` table) if not found (default role: `standard`).
   - Attaches `req.user = { sub, email, role, displayName }`.
   - If the token is missing or invalid, `req.user` is left `null` (the route decides whether auth is required).

4. **Route classification**:
   - **Public** (no token needed): `/api/proxy`, `/api/unsupported-plugins`, `/api/registry/*`, `/api/scan-history`, `/api/scan-history/:domain`.
   - **User-required** (valid token needed): GET/POST/PUT/DELETE `/api/user/scans`, `/api/user/notes`.
   - **Admin-required** (valid token with `role=admin` needed): `/api/admin/*`, `/api/logs/*` (replacing the existing `requireAdminApiKey` for interactive use; the admin API key header is kept as a deploy-time fallback).

## Rate Limiting

The existing `express-rate-limit` middleware at `/api` level is extended to read `req.user`.

| Tier           | Limit                               | Key              |
|----------------|-------------------------------------|------------------|
| Unauthenticated| 10 req/min across all `/api` routes | IP address       |
| Standard user  | 60 req/min across `/api`, 5 req/min on `/api/proxy` | `req.user.sub` |
| Admin          | 120 req/min across `/api`, no proxy limit           | `req.user.sub` |

Limits are in-memory (no Redis), sufficient for demo/traffic volumes.

## API Endpoints

### New user-owned endpoints

| Method | Path                      | Purpose |
|--------|---------------------------|---------|
| GET    | `/api/user/scans`         | Returns scan_domains owned by the authenticated user. |
| POST   | `/api/user/scans`         | Claims/associates a domain scan with the authenticated user. Body: `{ domain, notes? }`. |
| DELETE | `/api/user/scans/:domain` | Removes a domain from the user's ownership (does not delete scan data). |
| GET    | `/api/user/notes`         | Returns notes for the authenticated user (optionally filtered by `?domain=`). |
| POST   | `/api/user/notes`         | Creates a note. Body: `{ domain, note_text }`. |
| PUT    | `/api/user/notes/:id`     | Updates a note's text. Body: `{ note_text }`. |
| DELETE | `/api/user/notes/:id`     | Deletes a note. |

### Modified existing endpoints

- `/api/scan-history` and `/api/scan-history/:domain` — remains public but if `req.user` exists, includes the user's ownership/notes flag in the response. No change to anonymous behavior.
- `/api/admin/*` — existing admin auth (`requireAdminApiKey`) is augmented to also accept Auth0 tokens with `role=admin`. The header-based key remains as a deploy-time fallback for scripts/heartbeat checks.

## Frontend Changes

### New pages/components

- **LoginButton** (atom) — renders Auth0 login/logout button, conditionally visible.
- **UserMenu** (molecule) — dropdown with user avatar/name, link to "My Scans", logout.
- **MyScansPage** (page) — list of domains owned by the user with notes and saved-at timestamps.
- **NoteEditor** (molecule) — inline note entry component for saved scans.

### Modified pages

- **AppLayout** — adds LoginButton/UserMenu in the header area.
- **ScanPage** — after a successful scan, shows a "Save to My Scans" button if authenticated.
- **ScanHistoryPage** — if authenticated, shows ownership status and "Save" action per domain.

### Env vars (VITE_*)

| Variable                              | Purpose                        |
|---------------------------------------|--------------------------------|
| `VITE_AUTH0_DOMAIN`                   | Auth0 tenant domain            |
| `VITE_AUTH0_CLIENT_ID`               | Auth0 SPA application client ID|
| `VITE_AUTH0_AUDIENCE`                 | API audience (matches Express) |
| `VITE_API_BASE_URL`                  | Express API URL (existing)     |

## Backend Changes

### New dependencies

- `jsonwebtoken` and `jwks-rsa` (or `@auth0/express-jwt` + `jwks-rsa`) — for token verification in Express.

### New middleware

- `middleware/requireAuth.js` — validates Auth0 Bearer token, extracts claims, auto-vivifies user, sets `req.user`.
- `middleware/requireAdmin.js` — checks `req.user.role === 'admin'`, returns 403 if not.

### Modified middleware

- `middleware/rateLimiter.js` — reads `req.user` to select rate limit tier.
- `middleware/adminAuth.js` — the existing `requireAdminApiKey` is kept but a new `requireAdminOrToken` is added that accepts either a valid Auth0 admin token OR the `x-wpjd-admin-key` header.

### New route files

- `routes/userScans.js` — handlers for `/api/user/scans` CRUD.
- `routes/userNotes.js` — handlers for `/api/user/notes` CRUD.

### New DB modules

- `db/users.js` — `findOrCreateUser(sub, email, displayName)`, `findUserById(id)`, `updateUserRole(id, role)`.
- `db/userScans.js` — `claimDomain(userId, domain, notes?)`, `getUserDomains(userId)`, `unclaimDomain(userId, domain)`.
- `db/userNotes.js` — `createNote(userId, domain, text)`, `getNotes(userId, domain?)`, `updateNote(noteId, userId, text)`, `deleteNote(noteId, userId)`.

## Rate Limiter Implementation Detail

The rate limiter key derivation logic:

```
function rateLimitKey(req) {
  if (req.user?.sub) return `user:${req.user.sub}`;
  return `ip:${req.ip}`;
}

function getRateLimitConfig(req) {
  if (!req.user) return { points: 10, duration: 60 }; // unauthenticated
  if (req.user.role === 'admin') return { points: 120, duration: 60 };
  if (req.path.startsWith('/api/proxy')) return { points: 5, duration: 60 };
  return { points: 60, duration: 60 };
}
```

The `rateLimiter.js` middleware uses `express-rate-limit`'s `keyGenerator` and `skip` options to implement this.

## Deployment Configuration

### Frontend (Netlify)

- Build command: `pnpm --filter frontend run build`
- Publish directory: `frontend/dist`
- Environment variables set in Netlify dashboard:
  - `VITE_API_BASE_URL` = `https://<render-app>.onrender.com`
  - `VITE_AUTH0_DOMAIN` = `<tenant>.auth0.com`
  - `VITE_AUTH0_CLIENT_ID` = `<client-id>`
  - `VITE_AUTH0_AUDIENCE` = `https://api.wp-json-discovery.com` (or your API identifier)
- `netlify.toml` redirects: single-page app catch-all (`/* -> /index.html 200`)
- No server-side rendering; purely static SPA delivery.

### Backend (Render.com)

- Service type: Web Service (Node)
- Build command: `pnpm install`
- Start command: `pnpm --filter wp-json-discovery-server run start`
- Environment variables set in Render dashboard:
  - `PORT` — Render sets this automatically
  - `TURSO_DATABASE_URL` — Turso DB URL (existing)
  - `TURSO_AUTH_TOKEN` — Turso auth token (existing)
  - `AUTH0_DOMAIN` — Auth0 tenant domain (for token verification)
  - `AUTH0_AUDIENCE` — API audience matching frontend
  - `ADMIN_API_KEY` — kept as deploy/script fallback
  - `FRONTEND_ORIGIN` — Netlify URL for CORS (`https://<app>.netlify.app`)
- Optional health check: GET `/health` returns `{ status: 'ok' }`

### Turso (database)

- Existing Turso DB retains all current tables.
- New migrations (version 5) add `users`, `scan_ownership`, `user_notes` tables.
- Migration logic in `server/src/db/client.js` is extended with new MIGRATIONS entry.

## Auth0 Configuration (External Setup)

Required manual steps (documented for whoever sets up the tenant):

1. Create an Auth0 tenant.
2. Create an API with identifier (e.g., `https://api.wp-json-discovery.com`) — this is the audience.
3. Create a Single Page Application client. Note the client ID.
4. Enable RBAC in the tenant settings.
5. In Actions/Rules: add a login action that copies `app_metadata.role` to the access token as a custom claim (namespaced, e.g., `https://wp-json-discovery/roles`).
6. Set `role` in app_metadata for admin users (default for new users is `standard`).

The implementation handles auto-vivification of users from the token claims, so the Auth0 tenant does not need to pre-provision user records in Turso.

## Data Access Rules

| Endpoint category            | Unauthenticated | Standard user | Admin          |
|------------------------------|-----------------|---------------|----------------|
| `/api/proxy`                 | Yes (strict RL) | Yes           | Yes            |
| `/api/unsupported-plugins`   | Yes (strict RL) | Yes           | Yes            |
| `/api/registry/*`            | Yes (strict RL) | Yes           | Yes            |
| `/api/scan-history` (public) | Yes (strict RL) | Yes           | Yes            |
| `/api/scan-history/:domain`  | Yes (strict RL) | Yes           | Yes            |
| `/api/user/scans`            | 401             | Own only      | Own only       |
| `/api/user/notes`            | 401             | Own only      | Own only       |
| `/api/admin/*`               | 401             | 403           | Yes            |
| `/api/logs/*`                | 401             | 403           | Yes            |

## Open Questions / Future Work

- **Batch scanning and scheduling**: Out of scope for this phase.
- **Credentialed scanning**: OAuth/application passwords for locked-down sites — not addressed here.
- **Email verification / signup flows**: Auth0 handles login; the app auto-vivifies on first token. No separate signup form is needed initially.
- **Rate limit persistence**: In-memory only. If traffic grows, migrate to a Redis-backed store for shared rate limit state across Render instances.

---

## To-Do Summary

1. Extend Turso schema (new migration v5 for users, scan_ownership, user_notes)
2. Add `db/users.js`, `db/userScans.js`, `db/userNotes.js` modules
3. Add Auth0 token verification middleware (`middleware/requireAuth.js`, `middleware/requireAdmin.js`)
4. Modify `middleware/rateLimiter.js` for tiered limits
5. Modify `middleware/adminAuth.js` to accept Auth0 tokens
6. Add `routes/userScans.js`, `routes/userNotes.js` route files
7. Register new routes and middleware in `server/src/index.js`
8. Update frontend: add Auth0 provider, LoginButton, UserMenu, MyScansPage, NoteEditor, SaveToMyScans
9. Update AppLayout, ScanPage, HistoryPage for auth-aware rendering
10. Add `netlify.toml` for SPA catch-all
11. Set up Auth0 tenant and configure env vars
12. Deployment test: deploy frontend to Netlify, backend to Render.com, verify end-to-end flow
