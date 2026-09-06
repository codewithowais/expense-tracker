import { getDB, withoutChangeEvents } from "@/lib/db/database";
import {
  metaRepo,
  SYNC_CURSOR_KEY,
  SYNC_LAST_AT_KEY,
  SYNC_PUSH_CURSOR_KEY,
} from "@/lib/repositories/meta";
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
type QueuedChange = { collection: SyncCollection; record: SyncRecord };
type EncodedPayload = { body: BodyInit; headers: Record<string, string> };

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

function advancePullCursor(
  pullCursor: string | null,
  records: SyncResponse["records"],
  serverTime: string,
): string {
  let maxRemote = pullCursor ?? "";
  for (const rec of records) {
    if (rec.updatedAt > maxRemote) maxRemote = rec.updatedAt;
  }
  const cappedRemote = maxRemote > serverTime ? serverTime : maxRemote;
  return cappedRemote > (pullCursor ?? "") ? cappedRemote : (pullCursor ?? serverTime);
}

function toGroups(entries: QueuedChange[]): SyncPushGroup[] {
  if (!entries.length) return [];
  const groups: SyncPushGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last?.collection === entry.collection) {
      last.records.push(entry.record);
    } else {
      groups.push({ collection: entry.collection, records: [entry.record] });
    }
  }
  return groups;
}

async function encodeSyncPayload(payload: SyncRequest): Promise<EncodedPayload> {
  const json = JSON.stringify(payload);
  const plainBytes = new TextEncoder().encode(json).byteLength;
  if (typeof CompressionStream === "undefined") return { body: json, headers: {} };
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressed = await new Response(stream).arrayBuffer();
    if (compressed.byteLength >= plainBytes) return { body: json, headers: {} };
    return { body: compressed, headers: { "content-encoding": "gzip" } };
  } catch {
    return { body: json, headers: {} };
  }
}

async function exchangeWithServer(
  since: string | null,
  entries: QueuedChange[],
): Promise<
  | { ok: true; records: SyncResponse["records"]; nextSince: string; pushed: number }
  | { ok: false; outcome: SyncOutcome }
> {
  const payload: SyncRequest = { since, changes: toGroups(entries) };
  try {
    const token = syncToken();
    const encoded = await encodeSyncPayload(payload);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-sync-token": token } : {}),
        ...encoded.headers,
      },
      body: encoded.body,
    });
    if (res.status === 503) return { ok: false, outcome: { status: "unconfigured" } };
    if (res.status === 413) {
      if (entries.length <= 1) {
        return { ok: false, outcome: { status: "error", message: "Sync payload too large" } };
      }
      const mid = Math.floor(entries.length / 2);
      const first = await exchangeWithServer(since, entries.slice(0, mid));
      if (!first.ok) return first;
      const second = await exchangeWithServer(first.nextSince, entries.slice(mid));
      if (!second.ok) return second;
      return {
        ok: true,
        records: [...first.records, ...second.records],
        nextSince: second.nextSince,
        pushed: first.pushed + second.pushed,
      };
    }
    if (!res.ok) {
      return { ok: false, outcome: { status: "error", message: `Server responded ${res.status}` } };
    }
    const data = (await res.json()) as SyncResponse;
    return {
      ok: true,
      records: data.records,
      nextSince: advancePullCursor(since, data.records, data.serverTime),
      pushed: entries.length,
    };
  } catch {
    return { ok: false, outcome: { status: "offline" } };
  }
}

async function doSync(): Promise<SyncOutcome> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline" };
  }

  const db = getDB();
  // `pullCursor` bounds what we ask the server for. `pushCursor` bounds which
  // local rows we consider "already sent" — it is advanced from THIS device's
  // own wall clock (`syncStart`), never from any row's `updatedAt` (which, for
  // rows pulled from a peer, carries that peer's clock). This makes push
  // immune to another device's clock skew.
  const syncStart = new Date().toISOString();
  const pullCursor = (await metaRepo.get(SYNC_CURSOR_KEY)) ?? null;
  const pushCursor = (await metaRepo.get(SYNC_PUSH_CURSOR_KEY)) ?? pullCursor;

  // --- Gather local changes since the push cursor (via the updatedAt index) ---
  const queued: QueuedChange[] = [];
  for (const collection of SYNC_COLLECTIONS) {
    const table = db.table(collection);
    const rows = (pushCursor
      ? await table.where("updatedAt").above(pushCursor).toArray()
      : await table.toArray()) as Row[];
    for (const row of rows) {
      if (!row.updatedAt) continue;
      const record: SyncRecord = {
        id: row.id,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt ?? null,
        doc: row,
      };
      queued.push({ collection, record });
    }
  }

  // --- Exchange with the server ---
  const exchange = await exchangeWithServer(pullCursor, queued);
  if (!exchange.ok) return exchange.outcome;

  // --- Apply pulled records (LWW) without re-triggering change events ---
  try {
    const byCollection = new Map<SyncCollection, SyncResponse["records"]>();
    for (const rec of exchange.records) {
      const arr = byCollection.get(rec.collection) ?? [];
      arr.push(rec);
      byCollection.set(rec.collection, arr);
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
    // Push cursor tracks THIS device's wall clock with no monotonic guard, so a
    // backward clock correction self-corrects on the next sync (harmless
    // re-push of already-synced rows) instead of stranding new edits above a
    // stale frontier.
    await metaRepo.set(SYNC_CURSOR_KEY, exchange.nextSince);
    await metaRepo.set(SYNC_PUSH_CURSOR_KEY, syncStart);
    await metaRepo.set(SYNC_LAST_AT_KEY, at);

    return { status: "ok", pushed: exchange.pushed, pulled, at };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Apply failed" };
  }
}

export async function lastSyncedAt(): Promise<string | undefined> {
  return metaRepo.get(SYNC_LAST_AT_KEY);
}
