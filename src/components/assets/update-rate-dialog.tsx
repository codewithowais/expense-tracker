"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/money-input";
import { LiveRateButton } from "./live-rate-button";
import { assetRepo } from "@/lib/repositories/assets";
import { canFetchRate, isFetchableMetal } from "@/lib/rates";
import type { Asset } from "@/lib/types";

interface UpdateRateDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One-tap revaluation: set today's rate (per unit) for a unit-priced asset, or
 * the current total value for a lump-sum asset. Re-stamps the "as of" time.
 */
export function UpdateRateDialog({ asset, open, onOpenChange }: UpdateRateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Keyed by asset id so the form re-initializes from the target asset
            each time it opens — no state-syncing effect needed. */}
        {asset ? (
          <RateForm key={asset.id} asset={asset} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RateForm({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const unitPriced = asset.quantity != null;
  const [value, setValue] = useState<number | null>(
    unitPriced ? asset.currentUnitPrice : asset.currentValue,
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (value == null) return;
    setSaving(true);
    try {
      await assetRepo.update(
        asset.id,
        unitPriced ? { currentUnitPrice: value } : { currentValue: value },
      );
      toast.success("Value updated");
      onClose();
    } catch {
      toast.error("Couldn’t update. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update value</DialogTitle>
        <DialogDescription>
          {unitPriced
            ? `Today's rate per ${asset.unit || "unit"} for ${asset.name}.`
            : `Today's total value of ${asset.name}.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="asset-rate-quick">
            {unitPriced ? `Current rate${asset.unit ? ` (per ${asset.unit})` : ""}` : "Current value"}
          </Label>
          {unitPriced && isFetchableMetal(asset.kind) && canFetchRate(asset.kind, asset.unit) ? (
            <LiveRateButton metal={asset.kind} unit={asset.unit} onRate={setValue} />
          ) : null}
        </div>
        <MoneyInput id="asset-rate-quick" size="md" value={value} onChange={setValue} autoFocus />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={() => void handleSave()}
          disabled={saving || value == null}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
