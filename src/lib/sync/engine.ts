import { getDB, withoutChangeEvents } from "@/lib/db/database";
import { metaRepo, SYNC_CURSOR_KEY, SYNC_LAST_AT_KEY } from "@/lib/repositories/meta";
import {
  SYNC_COLLECTIONS,
  type SyncCollection,
  type SyncPushGroup,
  type SyncRecord,
  type SyncRequest,
  type SyncResponse,
} from "./types";

export type SyncOutcome =
  | { status: "ok"; pushed: number; pulled: number; at: string }
  | { status: "unconfigured" }
  | { status: "offline" }
  | { status: "error"; message: string };

type Row = { id: string; updatedAt: string; deletedAt?: string | null } & Record<string, unknown>;

function syncToken(): string | undefined {
  return process.env.NEXT_PUBLIC_SYNC_TOKEN || undefined;
}

/** Fetch whether the server has a Neon connection configured. */
export async function fetchSyncConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/sync/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

let running: Promise<SyncOutcome> | null = null;

/** Push local changes and pull remote changes (last-write-wins). Coalesced. */
export function syncNow(): Promise<SyncOutcome> {
  if (running) return running;
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<SyncOutcome> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline" };
  }

  const db = getDB();
  const cursor = (await metaRepo.get(SYNC_CURSOR_KEY)) ?? null;

  // --- Gather local changes since the cursor ---
  const changes: SyncPushGroup[] = [];
  let maxLocal = cursor ?? "";
  for (const collection of SYNC_COLLECTIONS) {
    const rows = (await db.table(collection).toArray()) as Row[];
    const records: SyncRecord[] = [];
    for (const row of rows) {
      if (!row.updatedAt) continue;
      if (cursor && row.updatedAt <= cursor) continue;
      records.push({
        id: row.id,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt ?? null,
        doc: row,
      });
      if (row.updatedAt > maxLocal) maxLocal = row.updatedAt;
    }
    if (records.length) changes.push({ collection, records });
  }

  const payload: SyncRequest = { since: cursor, changes };

  // --- Exchange with the server ---
  let data: SyncResponse;
  try {
    const token = syncToken();
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-sync-token": token } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 503) return { status: "unconfigured" };
    if (!res.ok) {
      return { status: "error", message: `Server responded ${res.status}` };
    }
    data = (await res.json()) as SyncResponse;
  } catch {
    return { status: "offline" };
  }

  // --- Apply pulled records (LWW) without re-triggering change events ---
  try {
    let maxRemote = maxLocal;
    const byCollection = new Map<SyncCollection, SyncResponse["records"]>();
    for (const rec of data.records) {
      const arr = byCollection.get(rec.collection) ?? [];
      arr.push(rec);
      byCollection.set(rec.collection, arr);
      if (rec.updatedAt > maxRemote) maxRemote = rec.updatedAt;
    }

    let pulled = 0;
    await withoutChangeEvents(async () => {
      for (const collection of SYNC_COLLECTIONS) {
        const incoming = byCollection.get(collection);
        if (!incoming?.length) continue;
        const table = db.table(collection);
        const ids = incoming.map((r) => String((r.doc as Row).id));
        const existing = (await table.bulkGet(ids)) as (Row | undefined)[];
        const localById = new Map<string, Row>();
        existing.forEach((row) => row && localById.set(row.id, row));

        const toPut: Row[] = [];
        for (const rec of incoming) {
          const doc = rec.doc as Row;
          const local = localById.get(doc.id);
          if (!local || rec.updatedAt > local.updatedAt) toPut.push(doc);
        }
        if (toPut.length) {
          await table.bulkPut(toPut);
          pulled += toPut.length;
        }
      }
    });

    const at = new Date().toISOString();
    const newCursor = maxRemote > (cursor ?? "") ? maxRemote : (cursor ?? at);
    await metaRepo.set(SYNC_CURSOR_KEY, newCursor);
    await metaRepo.set(SYNC_LAST_AT_KEY, at);

    const pushed = changes.reduce((n, g) => n + g.records.length, 0);
    return { status: "ok", pushed, pulled, at };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Apply failed" };
  }
}

export async function lastSyncedAt(): Promise<string | undefined> {
  return metaRepo.get(SYNC_LAST_AT_KEY);
}
