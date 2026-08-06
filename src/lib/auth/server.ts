import "server-only";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";

/** The email that is granted the super-admin role on sign-up. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

/**
 * Better Auth server instance backed by the project's Neon Postgres.
 * The Pool is created lazily by pg (no connection until first query), so
 * importing this module during build without a live DB is safe.
 */
export const auth = betterAuth({
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
  // Durable, DB-backed rate limiting (works across serverless instances).
  rateLimit: { enabled: true, storage: "database" },
});

export type Auth = typeof auth;
