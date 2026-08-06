import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getActiveUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

/**
 * POST /api/admin/users/[id]/status — soft deactivate/reactivate a user.
 * Body: { active: boolean }. active:false sets "deactivatedAt" = now();
 * active:true clears it. Never hard-deletes. Admin only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  let body: { active?: unknown };
  try {
    body = (await request.json()) as { active?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "`active` must be a boolean" }, { status: 400 });
  }

  // Guard against an admin locking themselves out.
  const me = await getActiveUser();
  if (me && (me as { id?: string }).id === id && body.active === false) {
    return NextResponse.json(
      { error: "You cannot deactivate your own admin account" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await pool.query<{ id: string; deactivatedAt: string | null }>(
      `UPDATE "user"
          SET "deactivatedAt" = ${body.active ? "NULL" : "now()"}
        WHERE id = $1
      RETURNING id, "deactivatedAt"`,
      [id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: rows[0].id,
      active: rows[0].deactivatedAt === null,
      deactivatedAt: rows[0].deactivatedAt,
    });
  } catch (err) {
    console.error("admin/users status update failed:", err);
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
  }
}
