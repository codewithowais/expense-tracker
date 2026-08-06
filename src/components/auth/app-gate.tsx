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

/**
 * Gates the app behind the signed-in session, then per-user first-run
 * onboarding and the quick-unlock PIN. The local database is pointed at the
 * current user before any data hook runs, so accounts never share local data.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;
  const [dbReadyFor, setDbReadyFor] = useState<string | null>(null);

  // Point the local store at this user before rendering anything that queries.
  useEffect(() => {
    setActiveUser(userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect the DB switch
    setDbReadyFor(userId);
  }, [userId]);

  if (!mounted || isPending) return <Splash />;
  // Middleware redirects unauthenticated users to /login; this is a safety net.
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

  // Ask the server whether THIS user has a PIN configured.
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
