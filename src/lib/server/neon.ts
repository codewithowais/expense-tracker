import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** True when a Neon connection string is configured on the server. */
export function isSyncConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let _sql: NeonQueryFunction<false, false> | null = null;
let schemaReady = false;

/** Server-only Neon SQL client, or null when sync isn't configured. */
export function getSql(): NeonQueryFunction<false, false> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

/** Create the single generic sync table on first use (idempotent). */
export async function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_records (
      collection text NOT NULL,
      id text NOT NULL,
      updated_at timestamptz NOT NULL,
      deleted_at timestamptz,
      doc jsonb NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sync_records_updated_at_idx ON sync_records (updated_at)`;
  schemaReady = true;
}

/**
 * Compare the request's sync token against SYNC_SECRET. When no secret is
 * configured the endpoint is open (single-user/offline default).
 */
export function isAuthorized(token: string | null): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  return token === secret;
}
