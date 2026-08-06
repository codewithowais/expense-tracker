import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getActiveUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

/** How long a freshly minted invite stays valid. */
const INVITE_TTL_DAYS = 14;

interface InviteRow {
  token: string;
  email: string | null;
  created_by: string | null;
  created_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
}

function inviteBase(request: Request): string {
  const env = process.env.BETTER_AUTH_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/** GET /api/invites — list invites (admin only). */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { rows } = await pool.query<InviteRow>(
      `SELECT token, email, created_by, created_at, expires_at, used_at, used_by
         FROM invites
        ORDER BY created_at DESC NULLS LAST`,
    );
    const base = inviteBase(request);
    return NextResponse.json({
      invites: rows.map((r) => ({ ...r, url: `${base}/signup?invite=${r.token}` })),
    });
  } catch (err) {
    console.error("invites list failed:", err);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }
}

/** POST /api/invites — mint a new invite token (admin only). Body: { email? }. */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = await getActiveUser();
  const createdBy = (admin as { id?: string } | null)?.id ?? null;

  let body: { email?: unknown } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    await pool.query(
      `INSERT INTO invites (token, email, created_by, created_at, expires_at)
       VALUES ($1, $2, $3, now(), $4::timestamptz)`,
      [token, email, createdBy, expiresAt],
    );

    const url = `${inviteBase(request)}/signup?invite=${token}`;
    return NextResponse.json({ token, email, expiresAt, url }, { status: 201 });
  } catch (err) {
    console.error("invite create failed:", err);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
