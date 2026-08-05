"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";

export default function AppError({
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
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center">
      <ErrorState
        title="This screen hit a snag"
        description="An unexpected error occurred. You can try reloading this section."
        onRetry={reset}
        className="w-full"
      />
    </div>
  );
}
