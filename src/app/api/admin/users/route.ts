import { NextResponse } from "next/server";
import { Pool } from "pg";
import { isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A single shared pg Pool across all admin route/page modules. Cached on
 * globalThis so `next dev` hot-reloads don't leak a new pool each time.
 */
const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  deactivatedAt: string | null;
  createdAt: string | null;
}

/** GET /api/admin/users — list every account (admin only). */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, name, role, "deactivatedAt", "createdAt"
         FROM "user"
        ORDER BY "createdAt" DESC NULLS LAST`,
    );
    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("admin/users list failed:", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
