import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

/**
 * POST /api/account/deactivate — the currently signed-in user soft-deactivates
 * their own account (sets "deactivatedAt" = now()). Never hard-deletes.
 */
export async function POST() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { rows } = await pool.query<{ id: string; deactivatedAt: string | null }>(
      `UPDATE "user"
          SET "deactivatedAt" = now()
        WHERE id = $1
      RETURNING id, "deactivatedAt"`,
      [userId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ id: rows[0].id, deactivatedAt: rows[0].deactivatedAt });
  } catch (err) {
    console.error("account deactivate failed:", err);
    return NextResponse.json({ error: "Failed to deactivate account" }, { status: 500 });
  }
}
