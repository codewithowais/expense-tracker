"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/shared/category-icon";
import { MoneyInput } from "@/components/shared/money-input";
import { DateField } from "@/components/shared/date-field";
import { ColorPicker } from "@/components/categories/color-picker";
import { IconPicker } from "@/components/categories/icon-picker";
import { assetRepo } from "@/lib/repositories/assets";
import { assetSchema, type AssetFormValues } from "@/lib/schemas";
import { ASSET_KINDS, ASSET_KIND_MAP, CATEGORY_COLORS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { Asset, AssetKind } from "@/lib/types";

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this asset instead of creating one. */
  asset?: Asset;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

function defaultsFor(asset?: Asset): AssetFormValues {
  const gold = ASSET_KIND_MAP.gold;
  return {
    name: asset?.name ?? "",
    kind: asset?.kind ?? "gold",
    quantity: asset?.quantity ?? null,
    unit: asset?.unit ?? gold.unit,
    purchaseDate: asset?.purchaseDate ?? todayISO(),
    purchaseAmount: asset?.purchaseAmount ?? (undefined as unknown as number),
    extraCost: asset?.extraCost ?? 0,
    currentUnitPrice: asset?.currentUnitPrice ?? null,
    currentValue: asset?.currentValue ?? null,
    note: asset?.note ?? "",
    color: asset?.color ?? gold.color ?? CATEGORY_COLORS[0],
    icon: asset?.icon ?? gold.icon,
  };
}

/** Create/edit dialog for a held asset (gold, property, shares, …). */
export function AssetDialog({ open, onOpenChange, asset }: AssetDialogProps) {
  const isEdit = Boolean(asset);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: defaultsFor(asset),
  });

  // Reset only when the dialog opens or the target asset changes — never on
  // background object-identity churn (a sync pull would wipe in-progress edits).
  useEffect(() => {
    if (open) reset(defaultsFor(asset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.id]);

  const name = useWatch({ control, name: "name" });
  const kind = useWatch({ control, name: "kind" });
  const color = useWatch({ control, name: "color" });
  const icon = useWatch({ control, name: "icon" });
  const quantity = useWatch({ control, name: "quantity" });
  const unit = useWatch({ control, name: "unit" });

  // A quantity means this is unit-priced (rate per unit); otherwise it's a
  // lump-sum asset valued by a single current total.
  const unitPriced = quantity != null && !Number.isNaN(quantity);

  function onKindChange(next: AssetKind) {
    setValue("kind", next, { shouldValidate: true });
    // On create, adopt the kind's sensible defaults; on edit, respect the
    // user's existing look and leave icon/color/unit alone.
    if (isEdit) return;
    const meta = ASSET_KIND_MAP[next];
    setValue("icon", meta.icon);
    setValue("color", meta.color);
    setValue("unit", meta.unit);
    if (!meta.unit) setValue("quantity", null);
  }

  async function onSubmit(values: AssetFormValues) {
    try {
      const isUnitPriced = values.quantity != null && !Number.isNaN(values.quantity);
      const payload = {
        name: values.name,
        kind: values.kind,
        quantity: isUnitPriced ? values.quantity : null,
        unit: isUnitPriced ? (values.unit ?? "") : "",
        purchaseDate: values.purchaseDate,
        purchaseAmount: values.purchaseAmount,
        extraCost: values.extraCost ?? 0,
        // Store the current figure that matches the asset's shape; clear the other.
        currentUnitPrice: isUnitPriced ? (values.currentUnitPrice ?? null) : null,
        currentValue: isUnitPriced ? null : (values.currentValue ?? null),
        note: values.note ?? "",
        color: values.color,
        icon: values.icon,
      };
      if (asset) {
        await assetRepo.update(asset.id, payload);
        toast.success("Asset updated");
      } else {
        await assetRepo.create(payload);
        toast.success("Asset added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details or current value of this holding."
              : "Record something you own and track its value over time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            <CategoryIcon icon={icon} color={color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {name || "Asset name"}
              </p>
              <p className="text-xs text-muted-foreground">Live preview</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              placeholder="e.g. Gold 2.5g 24k"
              {...register("name")}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {fieldError(errors.name?.message)}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-kind">Kind</Label>
            <Select value={kind} onValueChange={(v) => onKindChange(v as AssetKind)}>
              <SelectTrigger id="asset-kind" className="w-full">
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-qty">Quantity (optional)</Label>
              <Input
                id="asset-qty"
                inputMode="decimal"
                placeholder="e.g. 2.5"
                aria-invalid={!!errors.quantity}
                {...register("quantity", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
              />
              {fieldError(errors.quantity?.message)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-unit">Unit</Label>
              <Input
                id="asset-unit"
                placeholder="e.g. gram"
                disabled={!unitPriced}
                aria-invalid={!!errors.unit}
                {...register("unit")}
              />
              {fieldError(errors.unit?.message)}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-date">Purchase date</Label>
            <Controller
              control={control}
              name="purchaseDate"
              render={({ field }) => (
                <DateField
                  id="asset-date"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disableFuture
                  aria-invalid={!!errors.purchaseDate}
                />
              )}
            />
            {fieldError(errors.purchaseDate?.message)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-paid">Purchase amount</Label>
              <Controller
                control={control}
                name="purchaseAmount"
                render={({ field }) => (
                  <MoneyInput
                    id="asset-paid"
                    size="md"
                    value={field.value ?? null}
                    onChange={(n) => field.onChange(n ?? undefined)}
                    aria-invalid={!!errors.purchaseAmount}
                  />
                )}
              />
              {fieldError(errors.purchaseAmount?.message)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-extra">Extra cost</Label>
              <Controller
                control={control}
                name="extraCost"
                render={({ field }) => (
                  <MoneyInput
                    id="asset-extra"
                    size="md"
                    value={field.value ?? null}
                    onChange={(n) => field.onChange(n ?? 0)}
                    aria-invalid={!!errors.extraCost}
                  />
                )}
              />
              {fieldError(errors.extraCost?.message)}
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Extra cost covers packaging, making charges, or fees — added to your cost basis.
          </p>

          {unitPriced ? (
            <div className="space-y-1.5">
              <Label htmlFor="asset-rate">
                Current rate{unit ? ` (per ${unit})` : ""} — optional
              </Label>
              <Controller
                control={control}
                name="currentUnitPrice"
                render={({ field }) => (
                  <MoneyInput
                    id="asset-rate"
                    size="md"
                    value={field.value ?? null}
                    onChange={(n) => field.onChange(n ?? null)}
                    aria-invalid={!!errors.currentUnitPrice}
                  />
                )}
              />
              {fieldError(errors.currentUnitPrice?.message)}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="asset-value">Current value (optional)</Label>
              <Controller
                control={control}
                name="currentValue"
                render={({ field }) => (
                  <MoneyInput
                    id="asset-value"
                    size="md"
                    value={field.value ?? null}
                    onChange={(n) => field.onChange(n ?? null)}
                    aria-invalid={!!errors.currentValue}
                  />
                )}
              />
              {fieldError(errors.currentValue?.message)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-note">Note (optional)</Label>
            <Input
              id="asset-note"
              placeholder="e.g. 24k, bought from Liberty"
              {...register("note")}
              aria-invalid={!!errors.note}
            />
            {fieldError(errors.note?.message)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Add asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
