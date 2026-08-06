import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getActiveUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

interface AllowlistRow {
  email: string;
  added_by: string | null;
  created_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/allowlist — list allowed signup emails (admin only). */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { rows } = await pool.query<AllowlistRow>(
      `SELECT email, added_by, created_at
         FROM signup_allowlist
        ORDER BY created_at DESC NULLS LAST`,
    );
    return NextResponse.json({ allowlist: rows });
  } catch (err) {
    console.error("allowlist list failed:", err);
    return NextResponse.json({ error: "Failed to load allowlist" }, { status: 500 });
  }
}

/** POST /api/allowlist — add an email (admin only). Body: { email }. */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = await getActiveUser();
  const addedBy = (admin as { id?: string } | null)?.id ?? null;

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO signup_allowlist (email, added_by, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (email) DO NOTHING`,
      [email, addedBy],
    );
    return NextResponse.json({ email }, { status: 201 });
  } catch (err) {
    console.error("allowlist add failed:", err);
    return NextResponse.json({ error: "Failed to add email" }, { status: 500 });
  }
}

/**
 * DELETE /api/allowlist — remove an email (admin only).
 * Accepts { email } in the JSON body or ?email= in the query string.
 */
export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    try {
      const body = (await request.json()) as { email?: unknown };
      if (typeof body.email === "string") email = body.email.trim().toLowerCase();
    } catch {
      // no body — fall through to validation
    }
  }

  if (!email) {
    return NextResponse.json({ error: "An email is required" }, { status: 400 });
  }

  try {
    const { rowCount } = await pool.query(`DELETE FROM signup_allowlist WHERE email = $1`, [email]);
    return NextResponse.json({ email, removed: rowCount ?? 0 });
  } catch (err) {
    console.error("allowlist remove failed:", err);
    return NextResponse.json({ error: "Failed to remove email" }, { status: 500 });
  }
}
