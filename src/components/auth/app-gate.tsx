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

/**
 * Gates the application behind first-run onboarding and the mandatory PIN lock.
 * The PIN requirement is determined by the server (APP_PIN env), so it is the
 * same across every device. Everything downstream can assume a ready session.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const unlocked = useLockStore((s) => s.unlocked);
  const pinRequired = useLockStore((s) => s.pinRequired);
  const setPinRequired = useLockStore((s) => s.setPinRequired);

  const mounted = useMounted();
  const [authChecked, setAuthChecked] = useState(false);

  // Seed defaults once on startup — writes must live outside live-query context.
  useEffect(() => {
    void ensureSeed();
  }, []);

  // Ask the server whether a PIN is required (env-driven, same everywhere).
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

  if (!mounted || settings === undefined || !authChecked) return <Splash />;
  if (!settings.hasCompletedSetup) return <Onboarding />;
  if (pinRequired && !unlocked) return <LockScreen name={settings.name || undefined} />;

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
