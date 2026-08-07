"use client";

import { useState } from "react";
import { MoreVertical, Pencil, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { assetRepo } from "@/lib/repositories/assets";
import { ASSET_KIND_MAP } from "@/lib/constants";
import { formatDate, formatPercent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetValuation } from "@/lib/assets";
import type { Asset } from "@/lib/types";

interface AssetCardProps {
  valuation: AssetValuation;
  onEdit: (asset: Asset) => void;
  onUpdateRate: (asset: Asset) => void;
}

/** Formats a quantity without trailing zeros ("2.5", "10"). */
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

export function AssetCard({ valuation, onEdit, onUpdateRate }: AssetCardProps) {
  const { asset, costBasis, worth, gain, gainPct } = valuation;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const kindLabel = ASSET_KIND_MAP[asset.kind]?.label ?? asset.kind;
  const up = gain != null && gain > 0;
  const down = gain != null && gain < 0;

  async function handleDelete() {
    setDeleting(true);
    try {
      await assetRepo.remove(asset.id);
      toast.success("Asset removed");
      setConfirmOpen(false);
    } catch {
      toast.error("Couldn’t remove the asset. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="card-elevated gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon icon={asset.icon} color={asset.color} size="md" />
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{asset.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {kindLabel}
              {asset.quantity != null ? ` · ${fmtQty(asset.quantity)} ${asset.unit}` : ""}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${asset.name}`}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onUpdateRate(asset)}>
              <RefreshCw /> Update value
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(asset)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">Current value</p>
        {worth != null ? (
          <p className="font-heading text-2xl font-semibold tabular-nums">
            <Money amount={worth} />
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateRate(asset)}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <TrendingUp className="size-4" /> Set today’s rate to see profit
          </button>
        )}
      </div>

      {gain != null ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums",
              up && "bg-income-soft text-income",
              down && "bg-expense-soft text-expense",
              !up && !down && "bg-muted text-muted-foreground",
            )}
          >
            <Money amount={gain} tone="net" signed />
            {gainPct != null ? <span>({formatPercent(gainPct, 1)})</span> : null}
          </span>
        </div>
      ) : null}

      <div className="mt-3 space-y-0.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <p className="flex items-center justify-between gap-2">
          <span>Cost basis</span>
          <Money amount={costBasis} className="tabular-nums" />
        </p>
        <p className="flex items-center justify-between gap-2">
          <span>Bought</span>
          <span>{formatDate(asset.purchaseDate)}</span>
        </p>
        {asset.priceUpdatedAt ? (
          <p className="flex items-center justify-between gap-2">
            <span>Valued</span>
            <span>{timeAgo(asset.priceUpdatedAt)}</span>
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {asset.name} from your holdings. You can add it again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
