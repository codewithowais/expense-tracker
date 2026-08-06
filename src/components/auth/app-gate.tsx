"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/layout/brand";
import { Onboarding } from "./onboarding";
import { LockScreen } from "./lock-screen";
import { ensureSeed } from "@/lib/db/seed";
import { fetchPinRequired } from "@/lib/auth-client";
import { useSettings } from "@/lib/hooks/use-data";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useLockStore } from "@/stores/lock-store";
import { useSession } from "@/lib/auth/client";
import { setActiveUser } from "@/lib/db/database";

/** localStorage key remembering the last signed-in user (for offline boot). */
export const LAST_USER_KEY = "ledgerly.lastUserId";

function readLastUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Gates the app behind the signed-in session, then per-user first-run
 * onboarding and the quick-unlock PIN. Works OFFLINE: when the Better Auth
 * session endpoint is unreachable, it boots from the last-known user id so a
 * logged-in user isn't locked out of their local-first data. The local
 * database is pointed at the current user before any data hook runs.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const { data: session, error } = useSession();
  const sessionUserId = session?.user?.id ?? null;

  // Remember the signed-in user so we can boot offline later.
  useEffect(() => {
    if (sessionUserId) {
      try {
        window.localStorage.setItem(LAST_USER_KEY, sessionUserId);
      } catch {
        // ignore storage failures
      }
    }
  }, [sessionUserId]);

  // If the session endpoint can't be reached — the OS may still report "online"
  // while the server is unreachable — stop waiting after a short grace period
  // and boot from the cached user instead of hanging on the splash.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (sessionUserId) return;
    const t = setTimeout(() => setTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, [sessionUserId]);

  const offline = mounted && typeof navigator !== "undefined" && !navigator.onLine;
  const sessionUnreachable = offline || Boolean(error) || timedOut;
  // Effective user: the live session, or (when the session can't be reached)
  // the last known user, so a logged-in user isn't locked out offline.
  const userId = sessionUserId ?? (sessionUnreachable ? readLastUserId() : null);

  const [dbReadyFor, setDbReadyFor] = useState<string | null>(null);
  useEffect(() => {
    setActiveUser(userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect the DB switch
    setDbReadyFor(userId);
  }, [userId]);

  if (!mounted) return <Splash />;
  // No user yet: either still resolving the session online (wait), or the
  // session is unreachable and there's no cached user to fall back to.
  // (Logged-out online users are redirected to /login by middleware.)
  if (!userId) return <Splash />;

  const deactivated = Boolean((session?.user as { deactivatedAt?: unknown } | undefined)?.deactivatedAt);
  if (deactivated) {
    if (typeof window !== "undefined") window.location.replace("/deactivated");
    return <Splash />;
  }

  // Wait until getDB() is pointed at this user's database.
  if (dbReadyFor !== userId) return <Splash />;

  return <AuthedApp fallbackName={session?.user?.name}>{children}</AuthedApp>;
}

function AuthedApp({ children, fallbackName }: { children: React.ReactNode; fallbackName?: string }) {
  const settings = useSettings();
  const unlocked = useLockStore((s) => s.unlocked);
  const pinRequired = useLockStore((s) => s.pinRequired);
  const setPinRequired = useLockStore((s) => s.setPinRequired);
  const [authChecked, setAuthChecked] = useState(false);

  // Seed this user's defaults once — writes must live outside live-query context.
  useEffect(() => {
    void ensureSeed();
  }, []);

  // Ask the server whether THIS user has a PIN configured (offline: cached).
  useEffect(() => {
    let active = true;
    void fetchPinRequired().then((required) => {
      if (!active) return;
      setPinRequired(required);
      setAuthChecked(true);
    });
    return () => {
      active = false;
    };
  }, [setPinRequired]);

  if (settings === undefined || !authChecked) return <Splash />;
  if (!settings.hasCompletedSetup) return <Onboarding />;
  if (pinRequired && !unlocked) return <LockScreen name={settings.name || fallbackName || undefined} />;

  return <>{children}</>;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="animate-pulse">
        <BrandMark className="size-14 rounded-2xl" />
      </div>
    </div>
  );
}
