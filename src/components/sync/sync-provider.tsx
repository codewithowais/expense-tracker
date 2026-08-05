"use client";

import { useEffect, useRef } from "react";
import { subscribeLocalChange } from "@/lib/db/database";
import { useSyncStore } from "@/stores/sync-store";

/**
 * Drives background sync: initial pass on mount, a debounced pass after any
 * local write, and passes on reconnect/refocus plus a periodic safety net.
 * Renders nothing.
 */
export function SyncProvider() {
  const init = useSyncStore((s) => s.init);
  const sync = useSyncStore((s) => s.sync);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const scheduleSync = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (useSyncStore.getState().configured) void sync();
      }, 1500);
    };

    const syncIfConfigured = () => {
      if (useSyncStore.getState().configured && navigator.onLine) void sync();
    };

    const unsubscribe = subscribeLocalChange(scheduleSync);
    window.addEventListener("online", syncIfConfigured);
    const onVisible = () => document.visibilityState === "visible" && syncIfConfigured();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(syncIfConfigured, 120_000);

    return () => {
      unsubscribe();
      window.removeEventListener("online", syncIfConfigured);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sync]);

  return null;
}
