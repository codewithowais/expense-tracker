import { NextResponse } from "next/server";
import { ensureSchema, getSql, isAuthorized } from "@/lib/server/neon";
import {
  SYNC_COLLECTIONS,
  type SyncCollection,
  type SyncPulledRecord,
  type SyncRequest,
  type SyncResponse,
} from "@/lib/sync/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_SET = new Set<string>(SYNC_COLLECTIONS);

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("x-sync-token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Sync is not configured", configured: false }, { status: 503 });
  }

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await ensureSchema(sql);

    // Push: upsert incoming records with last-write-wins on updated_at.
    for (const group of body.changes ?? []) {
      if (!COLLECTION_SET.has(group.collection)) continue;
      for (const rec of group.records ?? []) {
        if (!rec?.id || !rec.updatedAt || !rec.doc) continue;
        await sql`
          INSERT INTO sync_records (collection, id, updated_at, deleted_at, doc)
          VALUES (
            ${group.collection},
            ${rec.id},
            ${rec.updatedAt}::timestamptz,
            ${rec.deletedAt ?? null}::timestamptz,
            ${JSON.stringify(rec.doc)}::jsonb
          )
          ON CONFLICT (collection, id) DO UPDATE
            SET updated_at = EXCLUDED.updated_at,
                deleted_at = EXCLUDED.deleted_at,
                doc = EXCLUDED.doc
            WHERE EXCLUDED.updated_at > sync_records.updated_at
        `;
      }
    }

    // Pull: everything changed since the client's last successful pull.
    const since = body.since ?? null;
    const rows = (await sql`
      SELECT collection, doc, updated_at, deleted_at
      FROM sync_records
      WHERE ${since}::timestamptz IS NULL OR updated_at > ${since}::timestamptz
      ORDER BY updated_at ASC
    `) as { collection: string; doc: Record<string, unknown>; updated_at: string; deleted_at: string | null }[];

    const records: SyncPulledRecord[] = rows
      .filter((r) => COLLECTION_SET.has(r.collection))
      .map((r) => ({
        collection: r.collection as SyncCollection,
        doc: r.doc,
        updatedAt: new Date(r.updated_at).toISOString(),
        deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
      }));

    const response: SyncResponse = { serverTime: new Date().toISOString(), records };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json({ error: "Sync failed on the server" }, { status: 500 });
  }
}
