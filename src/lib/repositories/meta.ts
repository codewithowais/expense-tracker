import { getDB } from "@/lib/db/database";

/** Local-only key/value store for sync bookkeeping (never synced upstream). */
export const metaRepo = {
  async get(key: string): Promise<string | undefined> {
    const row = await getDB().meta.get(key);
    return row?.value;
  },
  async set(key: string, value: string): Promise<void> {
    await getDB().meta.put({ key, value });
  },
};

export const SYNC_CURSOR_KEY = "sync.cursor";
/** Cursor for local rows already pushed upstream (separate from the pull cursor
 * so a peer device's skewed clock can never suppress this device's own pushes). */
export const SYNC_PUSH_CURSOR_KEY = "sync.pushCursor";
export const SYNC_LAST_AT_KEY = "sync.lastAt";
