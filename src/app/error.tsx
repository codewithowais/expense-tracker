"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";

/** Catches render errors thrown above the (app) segment (e.g. in AppGate). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <ErrorState
        title="Something went wrong"
        description="Ledgerly hit an unexpected error. Your data is safe on this device — try again."
        onRetry={reset}
        className="w-full max-w-md"
      />
    </div>
  );
}
