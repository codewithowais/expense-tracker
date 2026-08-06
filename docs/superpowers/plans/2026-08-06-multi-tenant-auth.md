# Multi-tenant Auth + Admin + Rate limiting + Multi-year Reports — Implementation Plan

> **For agentic workers:** implement task-by-task; each task ends with tsc/lint/build green (Node ≥ 20) and a commit. Spec: `docs/superpowers/specs/2026-08-06-multi-tenant-auth-admin-reports-design.md`.

**Goal:** Multi-tenant accounts (Better Auth on Neon) with per-user data isolation, per-user PIN, admin/super-user oversight, closed signup (allowlist + invites), soft-delete/deactivation, rate limiting, and multi-year reports — shipped on a branch + Vercel preview, promoted to prod only after verification.

**Architecture:** Better Auth (email+password, sessions in Neon) is the identity layer. The existing local-first Dexie store is namespaced per user; the sync engine authenticates via the session cookie and `/api/sync` scopes all rows by a session-derived `user_id`. Admin features use Better Auth's admin plugin + custom read-only ledger endpoints.

**Tech Stack:** Next 16, React 19, TS strict, Tailwind v4, Dexie, `better-auth`, `pg` (Neon pooled), Zustand, Recharts.

## Global Constraints
- Node ≥ 20 to build/run (Next 16); use `/usr/local/opt/node@22/bin` locally.
- No hard delete; no bulk "delete everything" anywhere. Deletion = soft `deactivatedAt`.
- Isolation is enforced ONLY by the session-derived `user_id` server-side — never trust client-provided ids.
- Admin = the user whose email === `process.env.ADMIN_EMAIL` (`codewithowais@gmail.com`).
- Work on branch `feat/multi-tenant-auth`; never push auth to `main` until verified on a preview.
- Env: add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`; remove `APP_PIN`, `SYNC_SECRET`, `NEXT_PUBLIC_SYNC_TOKEN`.

---

## Phase 0 — Reports: multi-year (independent, ship first)
**Files:** `src/lib/analytics.ts` (+`yearlySeries`), `src/lib/dates.ts` (+`This year`/`Last year`/`All time`/custom presets + `rangeMonths`), `src/components/shared/period-controls.tsx` (custom range picker), `src/components/reports/{trend,summary,category}-report.tsx` (adaptive bucketing), `src/lib/__tests__/core.test.ts` (+tests).
- Add presets; add `yearlySeries(txns, range)`; reports switch month→year grouping when `rangeMonths(range) > 24`; add a year-over-year table to the summary/trend report.
- Tests: yearly bucketing totals; preset ranges; >24-month switch. Commit.

## Phase 1 — Better Auth core
**Files:** `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/db/pg.ts` (shared `pg` Pool over `DATABASE_URL`), `.env.example`.
- `server.ts`: `betterAuth({ database: new Pool({connectionString: DATABASE_URL}), emailAndPassword:{enabled:true}, plugins:[admin({ adminRoles:["admin"] })], user:{ additionalFields:{ role, deactivatedAt, pinHash, pinSalt, failedPinAttempts, pinLockedUntil } }, rateLimit:{ enabled:true, storage:"database" }, secret: BETTER_AUTH_SECRET, baseURL: BETTER_AUTH_URL })`.
- `client.ts`: `createAuthClient({ plugins:[adminClient()] })` → `signIn/signUp/signOut/useSession`.
- Route handler mounts `auth.handler`.
- Generate schema: `npx @better-auth/cli generate` → produces a migration SQL file `src/lib/auth/migrations/*.sql` (committed). Verify build. Commit.

## Phase 2 — DB migration script (Better Auth tables + sync_records user_id + allowlist/invites)
**Files:** `scripts/migrate.mjs` (run manually with `DATABASE_URL`), `src/lib/server/neon.ts` (update `ensureSchema` for `user_id`).
- `scripts/migrate.mjs`: create Better Auth tables (from generated SQL); `DROP TABLE IF EXISTS sync_records; CREATE TABLE sync_records(user_id text NOT NULL, collection text, id text, updated_at timestamptz, deleted_at timestamptz, doc jsonb, PRIMARY KEY(user_id,collection,id)); CREATE INDEX ON sync_records(user_id, updated_at);`; create `signup_allowlist`, `invites`. Idempotent.
- Document: user runs `DATABASE_URL=... node scripts/migrate.mjs` (or authorizes it). Commit.

## Phase 3 — Login / signup pages + route gating
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/layout.tsx`, `src/middleware.ts`, `src/lib/auth/session.ts` (`getSession`, `requireUser`, `requireAdmin`).
- Login/signup forms (react-hook-form + zod), branded to the app; signup takes optional `?invite=` token.
- `middleware.ts`: unauthenticated → `/login`; authed on `/login|/signup` → `/`; `/admin/*` requires admin role; deactivated → `/deactivated`.
- Commit.

## Phase 4 — Signup control (allowlist + invites)
**Files:** `src/lib/auth/gate.ts` (allowlist/invite check), Better Auth `databaseHooks.user.create.before` in `server.ts`, `src/app/api/invites/route.ts` (admin create), `src/app/api/allowlist/route.ts` (admin CRUD).
- `before` hook: permit if `email===ADMIN_EMAIL` || in `signup_allowlist` || valid unused/unexpired invite (passed via signup body); mark invite used. Reject otherwise.
- Tests for `gate.ts` acceptance logic. Commit.

## Phase 5 — Per-user data isolation (sync)
**Files:** `src/app/api/sync/route.ts` (session-scoped), `src/lib/sync/engine.ts` (credentials:"include"; drop token), `src/lib/db/database.ts` (per-user DB name), `src/stores/auth-store.ts` (current userId), `src/components/auth/app-gate.tsx` (wire session → db).
- `/api/sync`: `const s = await getSession(req.headers); if(!s||s.user.deactivatedAt) return 401;` use `s.user.id` for all push/pull; remove token auth.
- `getDB()` uses `ledgerly-<userId>`; reset singleton on user change; `ensureSeed` per user.
- **Isolation test:** two users' sync payloads never cross (integration/manual). Commit.

## Phase 6 — Per-user PIN
**Files:** `src/app/api/lock/route.ts` (session + per-user hash + lockout), `src/lib/auth-client.ts` (unchanged offline fallback, keyed per user), onboarding sets PIN, remove `APP_PIN`.
- `/api/lock` GET → `{pinRequired: !!user.pinHash}`; POST verifies against user hash; increments `failedPinAttempts`, sets `pinLockedUntil` after 5 fails (60s), resets on success; 401 without session. Commit.

## Phase 7 — Admin panel
**Files:** `src/app/admin/layout.tsx` (requireAdmin), `src/app/admin/page.tsx` (counts + user list w/ badges), `src/app/admin/users/[id]/page.tsx` (read-only ledger), `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/ledger/route.ts`, `src/app/api/admin/users/[id]/(de)activate/route.ts`, allowlist/invite management UI.
- All admin routes call `requireAdmin` server-side. Ledger route reads `sync_records WHERE user_id=[id]`, returns summary + recent txns. Commit.

## Phase 8 — Soft-delete / deactivation + remove bulk wipe
**Files:** `src/app/api/account/deactivate/route.ts` (self), `src/app/(app)/settings/page.tsx` (replace "Clear all data" with "Delete account"), `src/lib/backup.ts` (remove `clearAllData` export/usage), login+sync+middleware check `deactivatedAt`.
- Self-deactivate sets `deactivatedAt`, revokes sessions. Admin (de)activate toggles it. "Deactivated" badge in admin list. Commit.

## Phase 9 — Rate limiting polish
**Files:** `src/lib/server/rate-limit.ts` (per-user/IP window for `/api/sync`), wire into sync route; confirm Better Auth `rateLimit` DB storage; PIN lockout (Phase 6).
- 429 responses with friendly copy. Tests for the limiter window. Commit.

## Phase 10 — Env/docs + verification + ship
**Files:** `.env.example`, `README.md`, `Dockerfile`/`docker-compose.yml` (drop public sync token arg; add BETTER_AUTH_* / ADMIN_EMAIL), `next.config.ts` (unchanged).
- Full `tsc`/`lint`/`test`/`build` (Node 22) green. Push branch. Hand off: user sets Vercel preview env + runs `scripts/migrate.mjs`; then browser-test the preview (signup gating, login→PIN, isolation across 2 users, admin list/ledger/deactivate, reports 4-year). Fix. Promote to `main`.

## Self-review
- Spec coverage: Phases map to spec §3.1–3.9, §6, §7. ✓
- No hard delete / bulk wipe: Phase 8 removes `clearAllData`. ✓
- Isolation single-point: Phase 5. ✓
- Reports multi-year: Phase 0. ✓
- Env changes: Phase 1/10. ✓
