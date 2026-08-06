import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Pool } from "pg";
import { ArrowLeft, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { getActiveUser, isAdmin } from "@/lib/auth/session";
import { totals } from "@/lib/analytics";
import type { Transaction } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

interface TxDoc {
  id?: string;
  type?: string;
  amount?: number;
  note?: string;
  date?: string;
  categoryId?: string;
  method?: string;
}

interface CatDoc {
  id?: string;
  name?: string;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function loadUser(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, name, role, "deactivatedAt", "createdAt" FROM "user" WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function loadDocs(id: string, collection: string): Promise<Record<string, unknown>[]> {
  try {
    const { rows } = await pool.query<{ doc: Record<string, unknown> }>(
      `SELECT doc FROM sync_records
        WHERE user_id = $1 AND collection = $2 AND deleted_at IS NULL`,
      [id, collection],
    );
    return rows.map((r) => r.doc).filter(Boolean);
  } catch (err) {
    console.error(`admin user ledger: load ${collection} failed:`, err);
    return [];
  }
}

async function setUserStatus(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  // Never let an admin deactivate their own account here.
  const me = await getActiveUser();
  if (!active && (me as { id?: string } | null)?.id === id) return;

  await pool.query(
    `UPDATE "user" SET "deactivatedAt" = ${active ? "NULL" : "now()"} WHERE id = $1`,
    [id],
  );
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin");
}

export default async function AdminUserLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) return null;

  const { id } = await params;
  const user = await loadUser(id);
  if (!user) notFound();

  const me = await getActiveUser();
  const isSelf = (me as { id?: string } | null)?.id === user.id;

  const [txDocsRaw, catDocsRaw] = await Promise.all([
    loadDocs(id, "transactions"),
    loadDocs(id, "categories"),
  ]);

  const txDocs = (txDocsRaw as TxDoc[]).filter(
    (d) => d.type === "income" || d.type === "expense",
  );
  const catNameById = new Map(
    (catDocsRaw as CatDoc[]).map((c) => [c.id ?? "", c.name ?? ""]),
  );

  const summary = totals(txDocs as unknown as Transaction[]);
  const recent = [...txDocs]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 25);

  const deactivated = Boolean(user.deactivatedAt);

  return (
    <>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>

      <PageHeader
        title={user.name || user.email}
        description={`${user.email} · joined ${fmtDate(user.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {deactivated ? (
              <Badge variant="destructive">Deactivated</Badge>
            ) : (
              <Badge variant="secondary" className="text-income">
                Active
              </Badge>
            )}
            {user.role === "admin" ? (
              <Badge variant="outline" className="text-primary">
                Admin
              </Badge>
            ) : null}
            <form action={setUserStatus}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="active" value={deactivated ? "true" : "false"} />
              <Button
                type="submit"
                variant={deactivated ? "default" : "destructive"}
                disabled={isSelf && !deactivated}
                title={
                  isSelf && !deactivated ? "You cannot deactivate your own account" : undefined
                }
              >
                {deactivated ? "Reactivate" : "Deactivate"}
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <LedgerStat label="Income" icon={<TrendingUp className="size-[1.05rem]" aria-hidden />} accent="income">
          <Money amount={summary.income} tone="income" />
        </LedgerStat>
        <LedgerStat label="Expense" icon={<TrendingDown className="size-[1.05rem]" aria-hidden />} accent="expense">
          <Money amount={summary.expense} tone="expense" />
        </LedgerStat>
        <LedgerStat label="Net" icon={<PiggyBank className="size-[1.05rem]" aria-hidden />} accent="primary">
          <Money amount={summary.net} tone="net" signed />
        </LedgerStat>
      </div>

      <SectionCard
        title="Recent transactions"
        description={`${summary.count} transaction${summary.count === 1 ? "" : "s"} on record (read-only).`}
        bodyClassName="p-0"
      >
        {recent.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={PiggyBank}
              title="No transactions"
              description="This user has not recorded any transactions yet."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((t, i) => (
              <li
                key={t.id || i}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {t.note || catNameById.get(t.categoryId ?? "") || "Transaction"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(t.date)}
                    {catNameById.get(t.categoryId ?? "")
                      ? ` · ${catNameById.get(t.categoryId ?? "")}`
                      : ""}
                    {t.method ? ` · ${t.method}` : ""}
                  </p>
                </div>
                <Money
                  amount={typeof t.amount === "number" ? t.amount : 0}
                  tone={t.type === "income" ? "income" : "expense"}
                  signed
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function LedgerStat({
  label,
  icon,
  accent,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-elevated rounded-2xl bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className="grid size-9 place-items-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklab, var(--${accent}) 15%, transparent)`,
            color: `var(--${accent})`,
          }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 font-heading text-2xl font-semibold tabular-nums">{children}</div>
    </div>
  );
}
