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
export const SYNC_LAST_AT_KEY = "sync.lastAt";
