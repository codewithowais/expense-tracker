import { NextResponse } from "next/server";
import { Pool } from "pg";
import { isAdmin } from "@/lib/auth/session";
import { totals } from "@/lib/analytics";
import type { Transaction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { __adminPgPool?: Pool };
const pool =
  globalForPool.__adminPgPool ??
  (globalForPool.__adminPgPool = new Pool({ connectionString: process.env.DATABASE_URL }));

interface TxDoc {
  id?: string;
  type?: string;
  amount?: number;
  note?: string;
  date?: string;
  categoryId?: string;
  method?: string;
}

/**
 * GET /api/admin/users/[id]/ledger — read-only summary of a user's ledger:
 * income/expense/net totals plus the most recent transactions. Admin only.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { rows } = await pool.query<{ doc: TxDoc }>(
      `SELECT doc
         FROM sync_records
        WHERE user_id = $1
          AND collection = 'transactions'
          AND deleted_at IS NULL`,
      [id],
    );

    const txs = rows
      .map((r) => r.doc)
      .filter((d): d is TxDoc => Boolean(d) && (d.type === "income" || d.type === "expense"));

    const summary = totals(txs as unknown as Transaction[]);

    const recent = [...txs]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 25)
      .map((d) => ({
        id: d.id ?? "",
        type: d.type ?? "",
        amount: typeof d.amount === "number" ? d.amount : 0,
        note: d.note ?? "",
        date: d.date ?? "",
        categoryId: d.categoryId ?? "",
        method: d.method ?? "",
      }));

    return NextResponse.json({ totals: summary, recent });
  } catch (err) {
    console.error("admin/users ledger failed:", err);
    return NextResponse.json({ error: "Failed to load ledger" }, { status: 500 });
  }
}
