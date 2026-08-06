import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Pool } from "pg";
import { ArrowRight, Copy, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { isAdmin, getActiveUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface AllowlistRow {
  email: string;
  added_by: string | null;
  created_at: string | null;
}

interface InviteRow {
  token: string;
  email: string | null;
  created_at: string | null;
  expires_at: string | null;
  used_at: string | null;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function inviteBase(): Promise<string> {
  const env = process.env.BETTER_AUTH_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function loadUsers(): Promise<UserRow[]> {
  try {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, name, role, "deactivatedAt", "createdAt"
         FROM "user"
        ORDER BY "createdAt" DESC NULLS LAST`,
    );
    return rows;
  } catch (err) {
    console.error("admin overview: load users failed:", err);
    return [];
  }
}

async function loadAllowlist(): Promise<AllowlistRow[]> {
  try {
    const { rows } = await pool.query<AllowlistRow>(
      `SELECT email, added_by, created_at FROM signup_allowlist ORDER BY created_at DESC NULLS LAST`,
    );
    return rows;
  } catch (err) {
    console.error("admin overview: load allowlist failed:", err);
    return [];
  }
}

async function loadInvites(): Promise<InviteRow[]> {
  try {
    const { rows } = await pool.query<InviteRow>(
      `SELECT token, email, created_at, expires_at, used_at
         FROM invites ORDER BY created_at DESC NULLS LAST`,
    );
    return rows;
  } catch (err) {
    console.error("admin overview: load invites failed:", err);
    return [];
  }
}

// ---- Server actions (each re-verifies admin — never trust the caller) ----

async function addAllowlistEmail(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const admin = await getActiveUser();
  const addedBy = (admin as { id?: string } | null)?.id ?? null;
  await pool.query(
    `INSERT INTO signup_allowlist (email, added_by, created_at)
     VALUES ($1, $2, now()) ON CONFLICT (email) DO NOTHING`,
    [email, addedBy],
  );
  revalidatePath("/admin");
}

async function removeAllowlistEmail(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email) return;
  await pool.query(`DELETE FROM signup_allowlist WHERE email = $1`, [email]);
  revalidatePath("/admin");
}

async function createInvite(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const raw = formData.get("email");
  const email = typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : null;
  const admin = await getActiveUser();
  const createdBy = (admin as { id?: string } | null)?.id ?? null;
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `INSERT INTO invites (token, email, created_by, created_at, expires_at)
     VALUES ($1, $2, $3, now(), $4::timestamptz)`,
    [token, email, createdBy, expiresAt],
  );
  revalidatePath("/admin");
}

function StatusBadge({ deactivatedAt }: { deactivatedAt: string | null }) {
  return deactivatedAt ? (
    <Badge variant="destructive">Deactivated</Badge>
  ) : (
    <Badge variant="secondary" className="text-income">
      Active
    </Badge>
  );
}

export default async function AdminOverviewPage() {
  if (!(await isAdmin())) return null;

  const [users, allowlist, invites, base] = await Promise.all([
    loadUsers(),
    loadAllowlist(),
    loadInvites(),
    inviteBase(),
  ]);

  const activeCount = users.filter((u) => !u.deactivatedAt).length;
  const deactivatedCount = users.length - activeCount;

  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage accounts, control who can sign up, and review activity."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Total users" value={users.length} />
        <SummaryTile label="Active" value={activeCount} tone="income" />
        <SummaryTile label="Deactivated" value={deactivatedCount} tone="expense" />
      </div>

      <SectionCard title="Users" description="Every account in this workspace." bodyClassName="p-0">
        {users.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Users} title="No users yet" description="Accounts appear here as people sign up." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{u.name || u.email}</span>
                      {u.role === "admin" ? (
                        <Badge variant="outline" className="text-primary">
                          Admin
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} · joined {fmtDate(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge deactivatedAt={u.deactivatedAt} />
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Signup allowlist"
          description="Only these emails may create an account."
        >
          <form action={addAllowlistEmail} className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="email"
              type="email"
              required
              placeholder="name@example.com"
              aria-label="Email to allow"
            />
            <Button type="submit" className="shrink-0">
              <UserPlus aria-hidden /> Add
            </Button>
          </form>

          {allowlist.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No emails allowlisted yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {allowlist.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-sm">{a.email}</span>
                  <form action={removeAllowlistEmail}>
                    <input type="hidden" name="email" value={a.email} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${a.email}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Invites" description="Share a link to let someone sign up.">
          <form action={createInvite} className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="email"
              type="email"
              placeholder="name@example.com (optional)"
              aria-label="Email for invite (optional)"
            />
            <Button type="submit" className="shrink-0">
              <Mail aria-hidden /> Create invite
            </Button>
          </form>

          {invites.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No invites created yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {invites.map((inv) => {
                const url = `${base}/signup?invite=${inv.token}`;
                const expired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false;
                const status = inv.used_at ? "Used" : expired ? "Expired" : "Active";
                return (
                  <li
                    key={inv.token}
                    className="rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {inv.email || "Anyone with the link"}
                      </span>
                      <Badge
                        variant={status === "Active" ? "secondary" : "outline"}
                        className={status === "Active" ? "text-income" : "text-muted-foreground"}
                      >
                        {status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                        {url}
                      </code>
                      <Copy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expires {fmtDate(inv.expires_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
}) {
  return (
    <div className="card-elevated rounded-2xl bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={
          "mt-2 font-heading text-2xl font-semibold tabular-nums " +
          (tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}
