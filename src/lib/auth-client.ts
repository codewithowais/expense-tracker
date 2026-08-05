"use client";

/** localStorage key caching the last known server PIN requirement. */
const PIN_REQUIRED_CACHE_KEY = "ledgerly.pinRequired";
/** localStorage keys for the offline-unlock fallback (salted PIN hash). */
const PIN_HASH_KEY = "ledgerly.pinHash";
const PIN_SALT_KEY = "ledgerly.pinSalt";

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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

/** Get (or lazily create) a random per-device salt for the PIN hash. */
function getSalt(): string {
  const existing = window.localStorage.getItem(PIN_SALT_KEY);
  if (existing) return existing;
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const salt = toHex(arr);
  window.localStorage.setItem(PIN_SALT_KEY, salt);
  return salt;
}

/**
 * Remember a correct PIN locally (as a salted hash) so it can be verified
 * offline later. This is a soft-lock convenience only — the local data is
 * already readable from IndexedDB, so the hash guards nothing the device
 * doesn't already hold; it exists purely to avoid locking a legitimate user
 * out of their own offline data. Requires a secure context (crypto.subtle).
 */
async function rememberPin(pin: string): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage || !window.crypto?.subtle) return;
  try {
    const hash = await sha256Hex(`${getSalt()}:${pin}`);
    window.localStorage.setItem(PIN_HASH_KEY, hash);
  } catch {
    // Insecure context or storage failure → offline unlock simply won't be available.
  }
}

/** Result of a PIN check. `reason` lets the UI explain a failure. */
export type VerifyReason = "verified" | "wrong" | "offline-no-cache";
export interface VerifyResult {
  ok: boolean;
  /** True when the check fell back to the local (offline) path. */
  offline: boolean;
  reason: VerifyReason;
}

/** Compare against the locally cached PIN hash (offline fallback). */
async function verifyCachedPin(pin: string): Promise<VerifyResult> {
  if (typeof window === "undefined" || !window.localStorage || !window.crypto?.subtle) {
    return { ok: false, offline: true, reason: "offline-no-cache" };
  }
  try {
    const stored = window.localStorage.getItem(PIN_HASH_KEY);
    const salt = window.localStorage.getItem(PIN_SALT_KEY);
    if (!stored || !salt) return { ok: false, offline: true, reason: "offline-no-cache" };
    const hash = await sha256Hex(`${salt}:${pin}`);
    // Constant-time-ish comparison.
    let diff = hash.length ^ stored.length;
    for (let i = 0; i < Math.max(hash.length, stored.length); i++) {
      diff |= (hash.charCodeAt(i) || 0) ^ (stored.charCodeAt(i) || 0);
    }
    return diff === 0
      ? { ok: true, offline: true, reason: "verified" }
      : { ok: false, offline: true, reason: "wrong" };
  } catch {
    return { ok: false, offline: true, reason: "offline-no-cache" };
  }
}

/**
 * Validate a PIN. Prefers the server (authoritative), and on a successful
 * server check caches a salted hash so the same PIN can unlock the app while
 * offline. If the server is unreachable, verifies against that cached hash
 * instead of failing closed — otherwise a correct PIN would be rejected and
 * the user locked out of their own local-first data whenever they're offline.
 */
export async function verifyAppPin(pin: string): Promise<VerifyResult> {
  try {
    const res = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return { ok: false, offline: false, reason: "wrong" };
    const data = (await res.json()) as { ok: boolean };
    const ok = Boolean(data.ok);
    if (ok) await rememberPin(pin);
    return { ok, offline: false, reason: ok ? "verified" : "wrong" };
  } catch {
    // No server / offline → fall back to the locally cached hash.
    return verifyCachedPin(pin);
  }
}
