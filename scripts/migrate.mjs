/*
 * App-specific DB migration for multi-tenant sync.
 *
 * SAFE / ADDITIVE — this does NOT drop or delete any existing data. It only:
 *   - adds a nullable `user_id` column to sync_records (existing rows keep NULL)
 *   - adds a (user_id, updated_at) index
 *   - creates the signup_allowlist and invites tables
 *
 * Better Auth's own tables (user, session, account, verification, rate limit)
 * are created separately by its CLI:  npx @better-auth/cli@latest migrate
 *
 * Usage:  DATABASE_URL="postgres://..." node scripts/migrate.mjs
 * (falls back to reading DATABASE_URL from a local .env file)
 */
import { Pool } from "pg";
import { readFileSync } from "node:fs";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // no .env — fall through
  }
  return null;
}

const url = resolveDatabaseUrl();
if (!url) {
  console.error("✗ No DATABASE_URL found (env or .env).");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

// `--fresh` performs the multi-tenant CUTOVER: it DROPS the old sync_records
// (discarding pre-accounts data — a fresh start) and recreates it with the
// user-scoped primary key. Better Auth tables are left untouched.
const fresh = process.argv.includes("--fresh");

const FRESH_STEPS = [
  ["drop old sync_records (fresh start)", `DROP TABLE IF EXISTS sync_records`],
  [
    "create sync_records (multi-tenant)",
    `CREATE TABLE sync_records (
      user_id text NOT NULL,
      collection text NOT NULL,
      id text NOT NULL,
      updated_at timestamptz NOT NULL,
      deleted_at timestamptz,
      doc jsonb NOT NULL,
      PRIMARY KEY (user_id, collection, id)
    )`,
  ],
  ["index sync_records(user_id, updated_at)", `CREATE INDEX IF NOT EXISTS sync_records_user_updated_idx ON sync_records (user_id, updated_at)`],
];

const ADDITIVE_STEPS = [
  ["add sync_records.user_id", `ALTER TABLE IF EXISTS sync_records ADD COLUMN IF NOT EXISTS user_id text`],
  ["index sync_records(user_id, updated_at)", `CREATE INDEX IF NOT EXISTS sync_records_user_updated_idx ON sync_records (user_id, updated_at)`],
  ["create signup_allowlist", `CREATE TABLE IF NOT EXISTS signup_allowlist (
      email text PRIMARY KEY,
      added_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
  ["create invites", `CREATE TABLE IF NOT EXISTS invites (
      token text PRIMARY KEY,
      email text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz,
      used_at timestamptz,
      used_by text
    )`],
];

// Common tables (created in both modes; the allowlist/invites steps live in
// ADDITIVE_STEPS from index 2 onward).
const STEPS = fresh ? [...FRESH_STEPS, ...ADDITIVE_STEPS.slice(2)] : ADDITIVE_STEPS;

try {
  for (const [label, sql] of STEPS) {
    await pool.query(sql);
    console.log("✓", label);
  }
  console.log(
    fresh
      ? "\n✓ Fresh-start migration complete (old sync_records dropped, multi-tenant schema created)."
      : "\n✓ App migration complete (additive, no data dropped).",
  );
  console.log("→ Better Auth tables: create with  npx @better-auth/cli@latest migrate  (if not already).");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
