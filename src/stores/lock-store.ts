"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface LockState {
  /** True once the user has passed the PIN gate for this browser session. */
  unlocked: boolean;
  /** Whether the deployment requires a PIN (APP_PIN configured). */
  pinRequired: boolean;
  setPinRequired: (required: boolean) => void;
  unlock: () => void;
  lock: () => void;
}

/**
 * Session-scoped unlock flag. Persisted to sessionStorage so a page refresh
 * keeps the app unlocked, but closing the tab re-locks it. `pinRequired` is
 * derived from the server (env APP_PIN) and kept in memory only.
 */
export const useLockStore = create<LockState>()(
  persist(
    (set) => ({
      unlocked: false,
      pinRequired: false,
      setPinRequired: (required) => set({ pinRequired: required }),
      unlock: () => set({ unlocked: true }),
      lock: () => set({ unlocked: false }),
    }),
    {
      name: "ledgerly.lock",
      storage: createJSONStorage(() => sessionStorage),
      // Only the unlock flag persists; pinRequired is refetched each load.
      partialize: (s) => ({ unlocked: s.unlocked }),
    },
  ),
);
