import { getDB } from "@/lib/db/database";
import { nowISO } from "@/lib/crypto";
import type { AppSettings } from "@/lib/types";

export const settingsRepo = {
  /** Returns `undefined` until first-run seeding creates the row. */
  async get(): Promise<AppSettings | undefined> {
    return getDB().settings.get("app");
  },

  async update(patch: Partial<Omit<AppSettings, "id" | "createdAt">>): Promise<void> {
    await getDB().settings.update("app", { ...patch, updatedAt: nowISO() });
  },
};
