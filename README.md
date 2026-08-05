# Ledgerly — Personal Finance Tracker

A calm, premium, **local-first** expense tracker. Track income and spending, lend and borrow, set budgets and savings goals, and see where your money goes — stored privately in your browser, with **optional two-way sync** to your own Neon database so mobile and web stay in step.

## Features

- **Dashboard** — net balance, savings rate, cash-flow trend, spending breakdown, budgets, people & debts, savings goals, and recent activity for any month.
- **Income & Expense management** — focused views per ledger side with breakdowns and trends.
- **Transactions** — a fast, searchable, filterable ledger (by text, type, category, method, amount, period) with inline edit/delete + undo.
- **Categories** — create, edit, recolor, re-icon, archive, and safely delete (with transaction reassignment).
- **Budgets** — monthly limits (overall and per-category) with live progress and over-/near-limit warnings.
- **People & Debts** — track money you lent to or borrowed from individuals, with repayments and per-person balances. Kept separate from spending.
- **Savings Goals** — set targets, log contributions/withdrawals, and watch progress toward each goal.
- **Analytics** — income vs. expense trends, category donuts, payment-method breakdown, largest transactions, and auto-generated insights.
- **Reports** — a clean, printable summary for any period with period-scoped CSV export.
- **Settings** — profile, currency, salary-cycle month start, theme, cloud sync, and full data import/export.
- **Data import/export** — JSON backup/restore and CSV transactions import/export.
- **App lock (PIN)** — a mandatory 4-digit PIN, configured via the `APP_PIN` environment variable and validated on the server, so it's the same on every device.
- **Cloud sync (optional)** — two-way, last-write-wins sync to your own Neon Postgres. Auto-syncs when online; works fully offline otherwise.

Every screen ships **loading, empty, success, and error** states, is fully **responsive**, **accessible**, and supports **light + dark** themes.

## Tech stack

- **Next.js 16** (App Router, typed routes) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Radix)
- **Dexie** (IndexedDB) for local-first persistence · **`@neondatabase/serverless`** for sync
- **Zustand** (UI/lock/sync state) · **dexie-react-hooks** (reactive queries)
- **Recharts 3** · **Motion** · **date-fns**
- **react-hook-form** + **Zod** · **Sonner** (toasts) · **next-themes**
- **Vitest** (unit tests)

## Getting started

```bash
npm install
cp .env.example .env   # then edit .env
npm run dev
```

Open http://localhost:3000. On first run you'll be guided through a short setup (name, currency, optional sample data).

### Environment (`.env`)

| Variable | Purpose |
| --- | --- |
| `APP_PIN` | 4-digit app-lock PIN, validated server-side. Same on every device; change it here and restart/redeploy. Leave blank to disable the lock. |
| `DATABASE_URL` | Neon Postgres connection string for cloud sync (`npx neonctl@latest init`). Leave blank to run fully offline. |
| `SYNC_SECRET` / `NEXT_PUBLIC_SYNC_TOKEN` | Optional shared secret to protect the sync endpoint. |

## Deploy to Vercel

Ledgerly is a standard Next.js App Router app and deploys to Vercel with **zero extra config** (no `vercel.json` needed).

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected as Next.js).
2. In **Project → Settings → Environment Variables**, add the variables from the table above for the **Production** (and **Preview**) environments. The local `.env` is git-ignored and is **not** uploaded, so these must be set in the dashboard:
   - `APP_PIN` — **required for the lock.** If it's unset, the app deploys with **no PIN lock**.
   - `DATABASE_URL` — use the **pooled** Neon connection string. If unset, the app still runs fully offline and cloud sync returns `503`.
   - `SYNC_SECRET` + `NEXT_PUBLIC_SYNC_TOKEN` — optional; if you set one, set **both** to the same value.
3. Deploy. Changing any env var later requires a **redeploy** to take effect.

> **Security:** treat `DATABASE_URL` as a secret. Never commit it — keep it only in `.env` (local) and the Vercel dashboard. If a connection string is ever exposed, rotate the password in the Neon console.

## Offline & installable (PWA)

Ledgerly ships a service worker ([`src/app/sw.js/route.ts`](src/app/sw.js/route.ts)) and a web manifest, so it installs as an app and keeps working with no connection:

- **Online:** pages and assets are fetched from the server (network-first) and written back to the cache, so you always get the latest version — no per-deploy cache-busting needed.
- **Offline:** the same requests fall back to the cache, so the app still opens and runs. Immutable build assets (`/_next/static/*`, including fonts) are served cache-first, so nothing is re-downloaded needlessly.
- **Writes made offline** are saved straight to IndexedDB (the local source of truth) and **queued for sync**; when connectivity returns, `SyncProvider` pushes them to Neon automatically (also on tab refocus and a periodic safety net).
- The API routes (`/api/lock`, `/api/sync`) are never cached — they always hit the network and fail gracefully when offline.

The worker registers in **production only** (it would fight Turbopack HMR in `next dev`), so test it with `npm run build && npx next start`.

## Run with Docker

A multi-stage [`Dockerfile`](Dockerfile) pinned to **Node 22** builds and runs the app the same way regardless of the host's Node version (a host Node change can't break it). It uses Next.js standalone output (`output: "standalone"`) for a small, self-contained image.

```bash
docker compose up --build
# → http://localhost:3000
```

Or plain Docker:

```bash
docker build -t ledgerly --build-arg NEXT_PUBLIC_SYNC_TOKEN="$NEXT_PUBLIC_SYNC_TOKEN" .
docker run -p 3000:3000 --env-file .env ledgerly
```

- **Server-only** vars (`DATABASE_URL`, `APP_PIN`, `SYNC_SECRET`) are read at **runtime** — pass them with `--env-file .env` (compose uses `env_file`).
- `NEXT_PUBLIC_*` vars are inlined at **build time**, so `NEXT_PUBLIC_SYNC_TOKEN` must be a **build arg** (already wired in `docker-compose.yml`).
- Building/running outside Docker needs **Node ≥ 20** (see `engines`) — Next.js 16 does not run on Node 16.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest (money / analytics / dates / debts / savings / csv logic)
```

## Architecture

Data is **local-first**: everything lives in IndexedDB via a single typed Dexie instance, accessed **only** through repositories (`src/lib/repositories/*`). The UI reads reactively via hooks in `src/lib/hooks/use-data.ts`, so any mutation instantly refreshes every view. When `DATABASE_URL` is set, a background sync engine mirrors changes to Neon using soft-delete tombstones and last-write-wins.

```
src/
  app/(app)/        # authed shell + feature routes
  app/api/          # sync + lock server routes (Neon, APP_PIN)
  components/
    auth/           # onboarding, PIN pad, lock screen, gate
    layout/         # sidebar, topbar, mobile nav, brand
    shared/         # PageHeader, SectionCard, StatCard, Money, states…
    transactions/ charts/ categories/ budgets/ money/
    people/ savings/ reports/ settings/ sync/
    ui/             # shadcn primitives
  lib/
    db/             # Dexie schema + seed
    repositories/   # settings, categories, transactions, budgets, people, savings, meta
    sync/           # sync engine + types
    server/         # server-only Neon client
    analytics.ts debts.ts savings.ts   # pure derivations
    dates.ts format.ts crypto.ts backup.ts csv.ts schemas.ts auth-client.ts
  stores/           # zustand (lock, quick-add, sync)
```

Money is stored in major units; aggregation is float-safe (`sumMoney`). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full component and API surface.

## Privacy

All data lives in your browser by default. Cloud sync is **opt-in** and goes only to **your own** Neon database via server-side API routes — the connection string is never exposed to the browser. Use **Settings → Data** to export a backup, and **Settings → Cloud sync** to enable syncing across devices.
