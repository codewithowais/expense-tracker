import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import type { BetterAuthOptions } from "better-auth";

/** The email that is granted the super-admin role on sign-up. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

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
} satisfies BetterAuthOptions;
