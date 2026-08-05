"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` after the first client render — the standard guard for
 * hydration-sensitive UI (theme, portals). Centralized so the single
 * intentional post-hydration setState lives in one place.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration flag
  useEffect(() => setMounted(true), []);
  return mounted;
}
