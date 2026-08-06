import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { Asset, AssetKind } from "@/lib/types";

export interface AssetInput {
  name: string;
  kind: AssetKind;
  quantity?: number | null;
  unit?: string;
  purchaseDate: string;
  purchaseAmount: number;
  extraCost?: number;
  currentUnitPrice?: number | null;
  currentValue?: number | null;
  note?: string;
  color: string;
  icon: string;
}

/** Whether a patch touches any of the current-price fields. */
function touchesPrice(patch: Partial<AssetInput>): boolean {
  return patch.currentUnitPrice !== undefined || patch.currentValue !== undefined;
}

export const assetRepo = {
  async list(): Promise<Asset[]> {
    const rows = (await getDB().assets.toArray()).filter((a) => !a.deletedAt);
    // Newest purchases first, then most recently added as a tiebreak.
    rows.sort((a, b) =>
      a.purchaseDate === b.purchaseDate
        ? b.createdAt.localeCompare(a.createdAt)
        : b.purchaseDate.localeCompare(a.purchaseDate),
    );
    return rows;
  },

  async get(id: string): Promise<Asset | undefined> {
    return getDB().assets.get(id);
  },

  async create(input: AssetInput): Promise<Asset> {
    const now = nowISO();
    const hasPrice = input.currentUnitPrice != null || input.currentValue != null;
    const row: Asset = {
      id: newId(),
      name: input.name.trim(),
      kind: input.kind,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() ?? "",
      purchaseDate: input.purchaseDate,
      purchaseAmount: Math.abs(input.purchaseAmount),
      extraCost: Math.abs(input.extraCost ?? 0),
      currentUnitPrice: input.currentUnitPrice ?? null,
      currentValue: input.currentValue ?? null,
      priceUpdatedAt: hasPrice ? now : null,
      note: input.note?.trim() ?? "",
      color: input.color,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().assets.add(row);
    return row;
  },

  async update(id: string, patch: Partial<AssetInput>): Promise<void> {
    const now = nowISO();
    const next: Partial<Asset> = { updatedAt: now };
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.kind !== undefined) next.kind = patch.kind;
    if (patch.quantity !== undefined) next.quantity = patch.quantity ?? null;
    if (patch.unit !== undefined) next.unit = patch.unit.trim();
    if (patch.purchaseDate !== undefined) next.purchaseDate = patch.purchaseDate;
    if (patch.purchaseAmount !== undefined) next.purchaseAmount = Math.abs(patch.purchaseAmount);
    if (patch.extraCost !== undefined) next.extraCost = Math.abs(patch.extraCost);
    if (patch.currentUnitPrice !== undefined) next.currentUnitPrice = patch.currentUnitPrice ?? null;
    if (patch.currentValue !== undefined) next.currentValue = patch.currentValue ?? null;
    if (patch.note !== undefined) next.note = patch.note.trim();
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.icon !== undefined) next.icon = patch.icon;
    // Re-stamp the valuation time whenever the current price/value changes.
    if (touchesPrice(patch)) next.priceUpdatedAt = now;
    await getDB().assets.update(id, next);
  },

  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().assets.update(id, { deletedAt: now, updatedAt: now });
  },
};
