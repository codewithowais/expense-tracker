"use client";

import { create } from "zustand";
import { fetchSyncConfigured, lastSyncedAt, syncNow } from "@/lib/sync/engine";

export type SyncStatus = "idle" | "syncing" | "ok" | "offline" | "error" | "unconfigured";

interface SyncStore {
  configured: boolean;
  status: SyncStatus;
  lastAt?: string;
  error?: string;
  /** Detect server configuration and run an initial sync. */
  init: () => Promise<void>;
  /** Run a sync pass and reflect the outcome in the store. */
  sync: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  configured: false,
  status: "idle",

  async init() {
    const [configured, lastAt] = await Promise.all([fetchSyncConfigured(), lastSyncedAt()]);
    set({ configured, lastAt, status: configured ? get().status : "unconfigured" });
    if (configured) await get().sync();
  },

  async sync() {
    if (get().status === "syncing") return;
    set({ status: "syncing", error: undefined });
    try {
      const outcome = await syncNow();
      switch (outcome.status) {
        case "ok":
          set({ status: "ok", configured: true, lastAt: outcome.at });
          break;
        case "unconfigured":
          set({ status: "unconfigured", configured: false });
          break;
        case "offline":
          set({ status: "offline" });
          break;
        case "error":
          set({ status: "error", error: outcome.message });
          break;
      }
    } catch (err) {
      // Never leave the indicator stuck spinning — surface the error instead.
      set({ status: "error", error: err instanceof Error ? err.message : "Sync failed" });
    }
  },
}));
