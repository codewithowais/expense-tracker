import { NextResponse } from "next/server";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-user quick-unlock PIN.
 *
 * The PIN is no longer a single shared `APP_PIN`; instead each user has their
 * own salted SHA-256 hash stored on their Better Auth `"user"` row
 * (`pinHash` / `pinSalt`). All operations here require an authenticated
 * session and act on that session user only.
 */

/** Lazily-created connection pool for the direct `pinHash`/`pinSalt` write. */
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

/**
 * In-memory, per-user lockout tracking. This is intentionally NOT persisted:
 * `failedPinAttempts`/`pinLockedUntil` are not columns. Acceptable for v1 —
 * the map resets on redeploy / server restart, which only ever relaxes a
 * lockout (fails open on restart), never tightens it.
 */
type LockState = { failures: number; lockedUntil: number };
const lockouts = new Map<string, LockState>();

/** After this many consecutive failures the account starts locking. */
const LOCK_THRESHOLD = 5;

/**
 * Escalating lock duration (ms) once past the threshold. Grows with the
 * number of failures beyond the threshold: ~60s, then doubling, capped.
 */
function lockDurationMs(failures: number): number {
  const over = Math.max(0, failures - LOCK_THRESHOLD);
  const base = 60_000; // ~60s
  const ms = base * 2 ** over;
  return Math.min(ms, 15 * 60_000); // cap at 15 minutes
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** SHA-256 of `${salt}:${pin}` as lowercase hex. */
function hashPin(salt: string, pin: string): string {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

/** Constant-time-ish comparison of two hex strings. */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

type SessionUser = {
  id: string;
  pinHash?: string | null;
  pinSalt?: string | null;
};

/** GET → whether the signed-in user has a quick-unlock PIN configured. */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ pinRequired: false }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const pinRequired = Boolean(user.pinHash);
  return NextResponse.json({ pinRequired });
}

type LockBody = { action?: "set" | "verify"; pin?: string };

/**
 * POST — set or verify the current user's PIN.
 *  - `{ action: "set", pin }`   → store a fresh salt + hash for this user.
 *  - `{ action: "verify", pin }`→ check against the stored hash (default).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const userId = user.id;

  let body: LockBody;
  try {
    body = (await request.json()) as LockBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pin = String(body.pin ?? "");
  const action = body.action ?? "verify";

  if (action === "set") {
    if (!pin) return NextResponse.json({ ok: false }, { status: 400 });
    const salt = toHex(randomBytes(16));
    const hash = hashPin(salt, pin);
    await getPool().query(
      'UPDATE "user" SET "pinHash" = $1, "pinSalt" = $2 WHERE id = $3',
      [hash, salt, userId],
    );
    // A freshly-set PIN clears any prior lockout state.
    lockouts.delete(userId);
    return NextResponse.json({ ok: true });
  }

  // action === "verify"
  const now = Date.now();
  const state = lockouts.get(userId);
  if (state && state.lockedUntil > now) {
    return NextResponse.json(
      { ok: false, lockedUntil: state.lockedUntil },
      { status: 429 },
    );
  }

  const storedHash = user.pinHash;
  const storedSalt = user.pinSalt;
  // No PIN configured for this user → nothing to verify against.
  if (!storedHash || !storedSalt) {
    return NextResponse.json({ ok: false });
  }

  const candidate = hashPin(storedSalt, pin);
  const ok = safeEqualHex(candidate, storedHash);

  if (ok) {
    lockouts.delete(userId);
    return NextResponse.json({ ok: true });
  }

  // Register the failure and possibly (re)arm the lockout.
  const failures = (state?.failures ?? 0) + 1;
  if (failures >= LOCK_THRESHOLD) {
    const lockedUntil = now + lockDurationMs(failures);
    lockouts.set(userId, { failures, lockedUntil });
    return NextResponse.json({ ok: false, lockedUntil }, { status: 429 });
  }
  lockouts.set(userId, { failures, lockedUntil: 0 });
  return NextResponse.json({ ok: false });
}
