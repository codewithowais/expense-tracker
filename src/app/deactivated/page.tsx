"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function DeactivatedPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="surface-hero surface-grain relative flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="size-14 rounded-2xl" />
        </div>

        <div className="rounded-3xl bg-background/95 p-7 text-foreground shadow-2xl backdrop-blur sm:p-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldOff className="size-6" />
            </span>
            <div className="space-y-1.5">
              <h1 className="font-heading text-2xl font-semibold">This account has been deactivated</h1>
              <p className="text-sm text-muted-foreground">
                You no longer have access to Ledgerly. If you think this is a mistake, please contact
                your administrator.
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="w-full gap-2"
              disabled={signingOut}
              onClick={handleSignOut}
            >
              {signingOut ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
