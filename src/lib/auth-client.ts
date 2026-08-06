"use client";

/**
 * Client helpers for the per-user quick-unlock PIN.
 *
 * The PIN is now stored per-user (a salted hash on the Better Auth user row)
 * rather than a single shared `APP_PIN`. The server at `/api/lock` is the
 * authority; every request sends `credentials: "include"` so the Better Auth
 * session cookie rides along.
 *
 * An OFFLINE fallback is kept: on a successful online verify we cache a salted
 * SHA-256 of the PIN in localStorage (namespaced per-user when we can read the
 * session's user id) so a correct PIN can still unlock the app while the
 * network is unreachable — otherwise a legitimate user would be locked out of
 * their own local-first data whenever they're offline.
 */

/** localStorage key caching the last known server PIN requirement. */
const PIN_REQUIRED_CACHE_KEY = "ledgerly.pinRequired";
/** Base localStorage keys for the offline-unlock fallback (salted PIN hash). */
const PIN_HASH_KEY = "ledgerly.pinHash";
const PIN_SALT_KEY = "ledgerly.pinSalt";

/** In-memory cache of the current user id (for namespacing storage keys). */
let cachedUserId: string | null = null;

/**
 * Best-effort read of the signed-in user's id from the Better Auth session,
 * used only to namespace the offline-fallback localStorage keys per-user. On
 * any failure we return null and callers fall back to un-namespaced keys.
 */
async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id?: string } } | null;
    const id = data?.user?.id ?? null;
    if (id) cachedUserId = id;
    return id;
  } catch {
    return null;
  }
}

/** Namespace a base storage key with the user id when one is available. */
function nsKey(base: string, userId: string | null): string {
  return userId ? `${base}.${userId}` : base;
}

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
 * Whether the signed-in user requires a PIN (they have one configured).
 * Fails CLOSED offline: if a PIN was previously confirmed required, that
 * cached result is returned even when the server can't be reached, so the
 * PIN gate is never silently skipped just because we're offline. Only
 * defaults to `false` when we've never successfully checked before (or when
 * the server says there is no session).
 */
export async function fetchPinRequired(): Promise<boolean> {
  try {
    const res = await fetch("/api/lock", {
      cache: "no-store",
      credentials: "include",
    });
    // No session (401) or other error → don't overwrite the cached value.
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

/** Get (or lazily create) a random per-device, per-user salt for the PIN hash. */
function getSalt(userId: string | null): string {
  const key = nsKey(PIN_SALT_KEY, userId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const salt = toHex(arr);
  window.localStorage.setItem(key, salt);
  return salt;
}

/**
 * Remember a correct PIN locally (as a salted hash) so it can be verified
 * offline later. This is a soft-lock convenience only — the local data is
 * already readable from IndexedDB, so the hash guards nothing the device
 * doesn't already hold; it exists purely to avoid locking a legitimate user
 * out of their own offline data. Requires a secure context (crypto.subtle).
 */
async function rememberPin(pin: string, userId: string | null): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage || !window.crypto?.subtle) return;
  try {
    const hash = await sha256Hex(`${getSalt(userId)}:${pin}`);
    window.localStorage.setItem(nsKey(PIN_HASH_KEY, userId), hash);
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
async function verifyCachedPin(pin: string, userId: string | null): Promise<VerifyResult> {
  if (typeof window === "undefined" || !window.localStorage || !window.crypto?.subtle) {
    return { ok: false, offline: true, reason: "offline-no-cache" };
  }
  try {
    const stored = window.localStorage.getItem(nsKey(PIN_HASH_KEY, userId));
    const salt = window.localStorage.getItem(nsKey(PIN_SALT_KEY, userId));
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
 * Set (or replace) the current user's quick-unlock PIN on the server. Called
 * during onboarding. On success, also seeds the offline-fallback cache so the
 * same PIN works offline immediately. Returns whether the server stored it.
 */
export async function setAppPin(pin: string): Promise<boolean> {
  const userId = await getUserId();
  try {
    const res = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "set", pin }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    const ok = Boolean(data.ok);
    if (ok) {
      await rememberPin(pin, userId);
      setCachedPinRequired(true);
    }
    return ok;
  } catch {
    // Offline: can't set a server PIN. Report failure so the UI can retry.
    return false;
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
  const userId = await getUserId();
  try {
    const res = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "verify", pin }),
    });
    if (!res.ok) return { ok: false, offline: false, reason: "wrong" };
    const data = (await res.json()) as { ok: boolean };
    const ok = Boolean(data.ok);
    if (ok) await rememberPin(pin, userId);
    return { ok, offline: false, reason: ok ? "verified" : "wrong" };
  } catch {
    // No server / offline → fall back to the locally cached hash.
    return verifyCachedPin(pin, userId);
  }
}
