import { CURRENCIES } from "@/lib/constants";
import { roundMoney } from "@/lib/format";
import type { AssetKind, CurrencyCode } from "@/lib/types";

/** Asset kinds we can auto-price from international spot markets. */
export type FetchableMetal = "gold" | "silver";

export function isFetchableMetal(kind: AssetKind): kind is FetchableMetal {
  return kind === "gold" || kind === "silver";
}

/** Grams per recognized mass unit; null means we can't convert a spot rate. */
const GRAMS_PER_UNIT: Record<string, number> = {
  gram: 1,
  grams: 1,
  g: 1,
  gm: 1,
  gms: 1,
  tola: 11.6638,
  tolas: 11.6638,
  oz: 31.1034768,
  ounce: 31.1034768,
  ounces: 31.1034768,
  kg: 1000,
  kilogram: 1000,
};

export function gramsForUnit(unit: string): number | null {
  return GRAMS_PER_UNIT[unit.trim().toLowerCase()] ?? null;
}

/** Whether a live rate can be fetched for this kind + unit combination. */
export function canFetchRate(kind: AssetKind, unit: string): boolean {
  return isFetchableMetal(kind) && gramsForUnit(unit) != null;
}

export interface LiveRate {
  /** Pure (24k/.999) price per the asset's unit, in the user's currency. */
  perUnit: number;
  /** Pure price per gram, in the user's currency. */
  perGram: number;
  /** ISO timestamp of the upstream quote, or null. */
  asOf: string | null;
}

/**
 * Fetch a live pure-metal rate for `metal` in `currency`, scaled to `unit`.
 * Throws on network failure, an unsupported unit, or an unsupported currency —
 * callers should fall back to manual entry.
 */
export async function fetchLiveRate(
  metal: FetchableMetal,
  currency: CurrencyCode,
  unit: string,
): Promise<LiveRate> {
  const grams = gramsForUnit(unit);
  if (grams == null) throw new Error("unit-not-supported");

  const res = await fetch(`/api/rates?metal=${metal}&currency=${encodeURIComponent(currency)}`);
  if (!res.ok) throw new Error("fetch-failed");

  const data = (await res.json()) as { pricePerGram?: number; asOf?: string | null };
  if (typeof data.pricePerGram !== "number") throw new Error("bad-response");

  const decimals = CURRENCIES[currency].decimals;
  return {
    perGram: roundMoney(data.pricePerGram, decimals),
    perUnit: roundMoney(data.pricePerGram * grams, decimals),
    asOf: data.asOf ?? null,
  };
}
