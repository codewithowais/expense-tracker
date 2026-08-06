import "server-only";
import { headers } from "next/headers";
import { auth } from "./server";

/** The current session (user + session), or null when signed out. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** A signed-in, non-deactivated user, or null. */
export async function getActiveUser() {
  const session = await getSession();
  if (!session?.user) return null;
  const deactivatedAt = (session.user as { deactivatedAt?: unknown }).deactivatedAt;
  if (deactivatedAt) return null;
  return session.user;
}

/** True when the current user holds the admin role. */
export async function isAdmin() {
  const user = await getActiveUser();
  return (user as { role?: string } | null)?.role === "admin";
}
