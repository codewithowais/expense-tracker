"use client";

import { useEffect } from "react";
import { Check, Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { useSyncStore } from "@/stores/sync-store";
import { useNow } from "@/lib/hooks/use-now";
import { formatClock, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cloud sync status + manual trigger, plus setup guidance when unconfigured. */
export function SyncSection() {
  const { configured, status, lastAt, error, init, sync } = useSyncStore();
  const now = useNow(15_000);

  // Re-check configuration when the section mounts (e.g. after adding .env).
  useEffect(() => {
    void init();
  }, [init]);

  const lastSyncLabel = lastAt
    ? `Last synced ${timeAgo(lastAt, now)} · ${formatClock(lastAt)}`
    : "Not synced yet";

  return (
    <SectionCard
      title="Cloud sync"
      description="Optional. Sync your data across devices via your own Neon database. Ledgerly always works offline first."
    >
      {configured ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-xl",
                status === "error" ? "bg-expense-soft text-expense" : "bg-income-soft text-income",
              )}
            >
              {status === "syncing" ? (
                <RefreshCw className="size-5 animate-spin" />
              ) : status === "error" ? (
                <TriangleAlert className="size-5" />
              ) : status === "offline" ? (
                <CloudOff className="size-5" />
              ) : (
                <Check className="size-5" />
              )}
            </span>
            <div>
              <p className="text-sm font-medium">
                {status === "syncing"
                  ? "Syncing…"
                  : status === "error"
                    ? "Last sync failed"
                    : status === "offline"
                      ? "Offline — changes saved locally"
                      : "Connected"}
              </p>
              <p className="text-xs text-muted-foreground">
                {error ? error : lastSyncLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                Syncs automatically when you’re online.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={status === "syncing"}
            onClick={() => void sync()}
          >
            <RefreshCw className={cn("size-4", status === "syncing" && "animate-spin")} />
            Sync now
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Cloud className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Not configured</p>
              <p className="text-xs text-muted-foreground">
                Running fully offline. Everything is stored locally in this browser.
              </p>
            </div>
          </div>
          <ol className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            <li>
              1. Run{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                npx neonctl@latest init
              </code>{" "}
              and copy the pooled connection string.
            </li>
            <li>
              2. Paste it as{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                DATABASE_URL
              </code>{" "}
              in your <span className="font-mono text-xs">.env</span> file.
            </li>
            <li>3. Restart the app and reload — sync turns on automatically.</li>
          </ol>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void init()}>
            <RefreshCw className="size-4" /> Re-check connection
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
