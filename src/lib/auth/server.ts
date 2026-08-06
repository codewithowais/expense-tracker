import "server-only";
import { betterAuth } from "better-auth";
import { authOptions } from "./options";

export { ADMIN_EMAIL } from "./options";

/**
 * Better Auth server instance backed by the project's Neon Postgres.
 * The Pool is created lazily by pg (no connection until first query), so
 * importing this module during build without a live DB is safe.
 */
export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
