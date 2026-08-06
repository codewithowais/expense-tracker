# Design: Multi-tenant accounts, admin, rate limiting & multi-year reports

Date: 2026-08-06
Status: Proposed (awaiting review)

## 1. Goal

Turn Ledgerly from a single-user, local-first app (shared env PIN, one un-scoped Neon table) into a **multi-tenant** app where each person has a private, login-protected ledger, plus a **super-user/admin** who can oversee users. Add **rate limiting** and make **Reports handle multi-year histories**.

## 2. Locked decisions

- **Multi-tenant** — every synced record and the sync engine are scoped by `userId`; isolation enforced server-side.
- **Auth stack: Better Auth (self-hosted)** on the existing Neon Postgres. Email + password + sessions. PIN remains as a per-user quick-unlock.
- **Fresh-start data** — the current mixed/sample Neon data is wiped; the owner exports a JSON backup first and re-imports after signup.
- **Signup control** — closed to the world: **admin-managed email allowlist AND admin-generated invite links** (either grants signup).
- **Super user** — the account with email `codewithowais@gmail.com` (via `ADMIN_EMAIL` env). Can see user count + all users (active and deactivated, with badges) and view any user's ledger read-only. Manages allowlist + invites.
- **Deletion policy** — no hard delete and **no bulk "delete everything" anywhere**. A user's "Delete account" performs a **soft deactivation** (data retained, login blocked, sync stops). Admin still sees deactivated accounts with a badge and can reactivate.

## 3. Architecture

### 3.1 Auth (Better Auth)
- `src/lib/auth/server.ts` — `betterAuth({ database: pgPool(DATABASE_URL), emailAndPassword: { enabled: true, requireEmailVerification: false /* v1 */ }, plugins: [admin()], user: { additionalFields: { role, deactivatedAt, pinHash, pinSalt } }, rateLimit: { enabled: true, storage: "database" } })`.
  - Database: a node-postgres/Neon `Pool` over `DATABASE_URL` (Neon's pooled Postgres endpoint).
  - Better Auth owns tables `user`, `session`, `account`, `verification` (+ its rate-limit table). Generated/migrated via `npx @better-auth/cli migrate`.
- `src/app/api/auth/[...all]/route.ts` — mounts the Better Auth handler.
- `src/lib/auth/client.ts` — `createAuthClient()` with the admin client plugin; exposes `signUp`, `signIn`, `signOut`, `useSession`.
- `getSession(headers)` server helper wrapping `auth.api.getSession`.
- **Roles:** `role: "admin" | "user"`. On signup, `email === ADMIN_EMAIL` → `role = "admin"`, else `"user"`.

### 3.2 Signup control (allowlist + invites)
- New tables:
  - `signup_allowlist (email text primary key, added_by text, created_at timestamptz)`
  - `invites (token text primary key, email text null, created_by text, created_at timestamptz, expires_at timestamptz null, used_at timestamptz null, used_by text null)`
- A Better Auth `databaseHooks.user.create.before` (or a wrapping signup route) rejects signup unless the email is on the allowlist **or** a valid unused, unexpired invite token is supplied. `ADMIN_EMAIL` is always permitted (bootstrap).
- Signup form accepts an optional `invite` token (also via `/signup?invite=<token>` deep link). Invite marked `used_at/used_by` on success.

### 3.3 Route gating
- `src/middleware.ts` — reads the session cookie; unauthenticated requests to `/` app routes redirect to `/login`; `/login` & `/signup` redirect to `/` if already authed. `/admin/*` additionally requires `role === "admin"`. `/api/sync` and `/api/lock` require a valid, non-deactivated session (returned 401 otherwise). Deactivated users are bounced to a "account deactivated" screen.

### 3.4 Per-user PIN (replaces shared APP_PIN)
- PIN is set during onboarding; stored as a per-user **salted hash** (`pinHash`, `pinSalt` on the user row). `APP_PIN` env is removed.
- `/api/lock` `GET` → `{ pinRequired: true }` when the session user has a `pinHash`; `POST { pin }` → verifies against the session user's hash (constant-time). Returns 401 if no session.
- Screen-lock UX (lock-store) stays: password login establishes the session, then the PIN gate unlocks the UI. Offline PIN fallback (cached salted hash) stays, keyed per user.

### 3.5 Data isolation (core)
- `sync_records` gains `user_id text NOT NULL`; PK becomes `(user_id, collection, id)`; index `(user_id, updated_at)`.
- `/api/sync` derives `userId` from the **session only** (never the request body). Push upserts rows with that `user_id`; pull filters `WHERE user_id = <session> AND (since IS NULL OR updated_at > since)`. This is the isolation guarantee.
- Token auth (`x-sync-token`/`SYNC_SECRET`/`NEXT_PUBLIC_SYNC_TOKEN`) is **removed**; the session cookie is the credential. The sync client sends credentials with `fetch(..., { credentials: "include" })`.
- **Local IndexedDB is namespaced per user:** DB name `ledgerly-<userId>`. `getDB()` reads the current user id (from a client auth store hydrated by `useSession`); switching accounts uses a different physical DB, so no cross-user leakage on a shared browser. On logout the singleton resets; the per-user DB is left intact for fast re-login (app is login-gated).
- `ensureSeed()` / onboarding run per user DB on first login.

### 3.6 Admin area (`/admin`, admin-only)
- **Overview:** total users, active vs deactivated counts, recent signups.
- **User list:** email, role, signup date, last sync, **status badge** (Active / Deactivated). Backed by Better Auth admin `listUsers` + a join on last sync activity.
- **User detail:** read-only view of that user's ledger — summary tiles + recent transactions + balances — via an **admin-only** server route `GET /api/admin/users/[id]/ledger` that checks `role === "admin"` server-side and reads `sync_records WHERE user_id = <id>`.
- **Access control:** allowlist + invites management UI (add/remove allowlisted emails, generate/revoke invite links).
- **Deactivation:** admin can deactivate/reactivate any account (sets/clears `deactivatedAt`). Admin cannot hard-delete and has no bulk-wipe.

### 3.7 Deactivation (soft delete)
- User self-serve: Settings → "Delete account" → confirmation → `POST /api/account/deactivate` sets `deactivatedAt = now()`, revokes the user's sessions. Login and sync then reject the user (`deactivatedAt != null`).
- Data (Better Auth user row + `sync_records`) is **retained**.
- Admin list shows deactivated accounts with a **"Deactivated" badge**; admin can reactivate (`deactivatedAt = null`).
- **Removed:** Settings → Danger Zone "Clear all data" (the only bulk wipe) is deleted. No code path deletes another user's data or all data.

### 3.8 Rate limiting
- **Auth endpoints:** Better Auth built-in rate limiting, `storage: "database"` (durable across Vercel's serverless instances).
- **PIN endpoint `/api/lock`:** per-user failed-attempt limiter — track `failedPinAttempts` + `pinLockedUntil` (on the user row or a small table); after N (e.g. 5) failures, lock for a cooldown (e.g. 60s, escalating). Success resets the counter.
- **Sync `/api/sync`:** lightweight per-user throttle (min interval / max requests per window) to prevent abuse; over-limit → 429.

### 3.9 Reports — multi-year
- **Period options:** add `This year`, `Last year`, `All time`, and a `Custom range` picker to `PresetSelect`/period controls.
- **Adaptive bucketing:** analytics gains `yearlySeries()`; the trend chart and monthly breakdown tables **switch from month to year grouping when the range spans more than ~24 months** (so 4 years shows ~4 yearly rows/bars, not 48). Small ranges keep daily/monthly as today.
- **New "Year over year" view** in the summary/trend report: income/expense/net per year with % change.

## 4. Data-model changes

- Better Auth tables: `user` (+ additional fields `role`, `deactivatedAt`, `pinHash`, `pinSalt`, `failedPinAttempts`, `pinLockedUntil`), `session`, `account`, `verification`, rate-limit table.
- App tables: `sync_records` + `user_id` (PK/index change); new `signup_allowlist`, `invites`.
- Local (Dexie): unchanged schema; only the **database name** becomes per-user.

## 5. API surface

- `POST/GET /api/auth/[...all]` — Better Auth.
- `GET/POST /api/lock` — session-scoped PIN check (rate-limited).
- `POST /api/sync` — session-scoped sync (rate-limited).
- `POST /api/account/deactivate` — self soft-delete.
- Admin (role-gated): `GET /api/admin/users`, `GET /api/admin/users/[id]/ledger`, `POST /api/admin/users/[id]/deactivate|reactivate`, allowlist CRUD, invite create/revoke. (Prefer Better Auth admin plugin endpoints where they exist; custom routes for ledger view + allowlist/invites.)

## 6. Env changes

- **Add:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (e.g. the deployment URL), `ADMIN_EMAIL=codewithowais@gmail.com`.
- **Remove:** `APP_PIN`, `SYNC_SECRET`, `NEXT_PUBLIC_SYNC_TOKEN`.
- Keep `DATABASE_URL`. Update `.env.example`, README, Docker docs/args (drop the public sync token build-arg).

## 7. Rollout / migration (fresh start)

1. Owner exports a JSON backup (Settings → Export) **before** deploy.
2. Deploy: run Better Auth migrations; `ALTER`/recreate `sync_records` with `user_id` (drops old mixed/sample rows); create `signup_allowlist`, `invites`.
3. Owner signs up with `codewithowais@gmail.com` → becomes admin.
4. Owner re-imports the JSON backup into their account.
5. Owner allowlists / invites any additional users.

## 8. Error handling

- Unauthorized/expired session → 401 (API) / redirect to `/login` (pages).
- Deactivated account → blocked login + "account deactivated" screen; sync/lock → 401.
- Signup not permitted (not allowlisted / bad invite) → clear form error.
- Rate-limited → 429 with a friendly "try again shortly" message; PIN lockout shows remaining cooldown.
- Sync offline → existing local-first behavior (queue, retry on reconnect) unchanged.

## 9. Testing

- Unit: PIN hash/verify + lockout counter; allowlist/invite acceptance logic; yearly bucketing in analytics; `deactivatedAt` gating helper.
- Integration/manual: signup gating (allowlist + invite), login→PIN flow, **isolation proof (user A cannot see user B's records via sync)**, admin list/counts/ledger-view/deactivate/reactivate, self-deactivate blocks login, reports across a seeded 4-year dataset, offline still works.

## 10. Out of scope (v1)

- Email verification & password reset emails (add later; needs an email provider).
- 2FA/TOTP, OAuth social login.
- Admin editing another user's data (view-only for now).
- Per-user encryption at rest of local data.

## 11. Risks / notes

- **Privacy:** admin can view all users' financial data (owner-accepted).
- **Isolation correctness is critical** — the session-derived `user_id` on `/api/sync` is the single enforcement point; must be covered by the isolation test.
- **Neon + Better Auth adapter:** confirm the Postgres pool works over Neon's pooled endpoint in the serverless runtime; fall back to the Neon serverless driver dialect if needed.
- **Scope is large** — implementation will be phased (see the plan): auth core → data isolation → PIN → signup control → admin → deactivation → rate limiting → reports. Reports (independent) can land first.
