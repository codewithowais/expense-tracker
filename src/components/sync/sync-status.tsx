"use client";

import { Check, Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSyncStore } from "@/stores/sync-store";
import { useNow } from "@/lib/hooks/use-now";
import { formatClock, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Compact cloud-sync indicator for the top bar. Hidden until sync is configured. */
export function SyncStatus() {
  const { configured, status, lastAt, sync } = useSyncStore();
  const now = useNow(15_000);
  if (!configured) return null;

  const ago = lastAt ? timeAgo(lastAt, now) : null;

  const tooltip =
    status === "syncing"
      ? "Syncing…"
      : status === "offline"
        ? "Offline — changes saved locally, will sync when you reconnect"
        : status === "error"
          ? "Sync failed — tap to retry"
          : lastAt
            ? `Last synced ${ago} · ${formatClock(lastAt)}`
            : "Connected";

  const Icon =
    status === "syncing"
      ? RefreshCw
      : status === "offline"
        ? CloudOff
        : status === "error"
          ? TriangleAlert
          : status === "ok"
            ? Check
            : Cloud;

  // Short text shown beside the icon on wider screens.
  const text =
    status === "syncing"
      ? "Syncing…"
      : status === "offline"
        ? "Offline"
        : status === "error"
          ? "Retry"
          : ago
            ? `Synced ${ago}`
            : "Synced";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors"
          aria-label={tooltip}
          onClick={() => void sync()}
        >
          <Icon
            className={cn(
              "size-[1.05rem] transition-colors",
              status === "syncing" && "animate-spin text-muted-foreground",
              status === "error" && "text-expense",
              status === "offline" && "text-muted-foreground",
              status === "ok" && "text-income",
            )}
          />
          <span className="hidden tabular-nums sm:inline">{text}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
