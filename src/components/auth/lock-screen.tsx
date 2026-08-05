"use client";

import { useState } from "react";
import { BrandMark } from "@/components/layout/brand";
import { PinPad } from "./pin-pad";
import { verifyAppPin } from "@/lib/auth-client";
import { useLockStore } from "@/stores/lock-store";
import { APP_NAME } from "@/lib/constants";

export function LockScreen({ name }: { name?: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const unlock = useLockStore((s) => s.unlock);

  async function attempt(candidate: string) {
    setChecking(true);
    const ok = await verifyAppPin(candidate);
    if (ok) {
      unlock();
    } else {
      setError(true);
      setTimeout(() => {
        setError(false);
        setPin("");
      }, 500);
    }
    setChecking(false);
  }

  return (
    <div className="surface-hero surface-grain relative flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="relative z-10 flex flex-col items-center">
        <BrandMark className="size-14 rounded-2xl" />
        <h1 className="mt-5 font-heading text-2xl font-semibold text-white/95">
          {name ? `Welcome back, ${name}` : APP_NAME}
        </h1>
        <p className="mt-1.5 text-sm text-white/60">Enter your PIN to unlock</p>

        <div className="mt-10 rounded-3xl bg-background/95 p-8 shadow-2xl backdrop-blur">
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={attempt}
            error={error}
            disabled={checking}
          />
        </div>
      </div>
    </div>
  );
}
