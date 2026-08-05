"use client";

/** localStorage key caching the last known server PIN requirement. */
const PIN_REQUIRED_CACHE_KEY = "ledgerly.pinRequired";

function getCachedPinRequired(): boolean | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PIN_REQUIRED_CACHE_KEY);
    return raw === null ? null : raw === "true";
  } catch {
    return null;
  }
}

function setCachedPinRequired(value: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PIN_REQUIRED_CACHE_KEY, String(value));
  } catch {
    // Ignore storage failures (private mode, quota, etc).
  }
}

/**
 * Whether the app requires a PIN (APP_PIN configured on the server).
 * Fails CLOSED offline: if a PIN was previously confirmed required, that
 * cached result is returned even when the server can't be reached, so the
 * mandatory PIN gate is never silently skipped just because we're offline.
 * Only defaults to `false` when we've never successfully checked before.
 */
export async function fetchPinRequired(): Promise<boolean> {
  try {
    const res = await fetch("/api/lock", { cache: "no-store" });
    if (!res.ok) return getCachedPinRequired() ?? false;
    const data = (await res.json()) as { pinRequired: boolean };
    const required = Boolean(data.pinRequired);
    setCachedPinRequired(required);
    return required;
  } catch {
    // No server / offline → fall back to the last known value.
    return getCachedPinRequired() ?? false;
  }
}

/** Validate a PIN against the server. Returns true when correct. */
export async function verifyAppPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
