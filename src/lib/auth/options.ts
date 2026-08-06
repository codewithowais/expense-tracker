import { admin } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { Pool } from "pg";
import type { BetterAuthOptions } from "better-auth";

/** The email that is granted the super-admin role on sign-up. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

/** Shared pool for signup-gate lookups (lazy; no connection until queried). */
const gatePool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Closed signup: an email may register only if it is the admin, on the
 * allowlist, or presents a valid unused/unexpired invite token. Enforced
 * server-side before the user row is created.
 */
async function assertSignupAllowed(email: string, inviteToken?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (normalized === ADMIN_EMAIL) return;

  const allow = await gatePool.query("SELECT 1 FROM signup_allowlist WHERE lower(email) = $1", [
    normalized,
  ]);
  if ((allow.rowCount ?? 0) > 0) return;

  if (inviteToken) {
    const inv = await gatePool.query(
      "SELECT token FROM invites WHERE token = $1 AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
      [inviteToken],
    );
    if ((inv.rowCount ?? 0) > 0) {
      await gatePool.query("UPDATE invites SET used_at = now(), used_by = $2 WHERE token = $1", [
        inviteToken,
        normalized,
      ]);
      return;
    }
  }

  throw new APIError("FORBIDDEN", {
    message: "This email isn’t invited yet. Ask the admin for an invite.",
  });
}

/**
 * Better Auth configuration. Kept free of `server-only` so tooling (the
 * Better Auth CLI, migrations) can import it in a plain Node context. The
 * live instance is created in `server.ts` (which IS server-only).
 */
export const authOptions = {
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      deactivatedAt: { type: "date", required: false, input: false },
      pinHash: { type: "string", required: false, input: false },
      pinSalt: { type: "string", required: false, input: false },
    },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  rateLimit: { enabled: true, storage: "database" },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const body = (ctx.body ?? {}) as { email?: string; inviteToken?: string };
        await assertSignupAllowed(body.email ?? "", body.inviteToken);
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user: { email?: string }) => {
          const isAdminEmail = (user.email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
          return { data: { ...user, role: isAdminEmail ? "admin" : "user" } };
        },
      },
    },
  },
} satisfies BetterAuthOptions;
