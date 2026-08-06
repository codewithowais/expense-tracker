import { roundMoney, sumMoney } from "./format";
import type { Asset } from "./types";

export interface AssetValuation {
  asset: Asset;
  /** What it cost to acquire: purchase amount + extra cost. */
  costBasis: number;
  /** Current worth, or null when no current price/value has been set yet. */
  worth: number | null;
  /** worth − costBasis, or null when worth is unknown. */
  gain: number | null;
  /** Gain as a percentage of cost basis (0–100 scale), or null. */
  gainPct: number | null;
}

/** Current worth of a single asset: quantity × unit price, or a direct value. */
export function assetWorth(asset: Asset): number | null {
  if (asset.quantity != null && asset.currentUnitPrice != null) {
    return roundMoney(asset.quantity * asset.currentUnitPrice);
  }
  return asset.currentValue;
}

export function valueAsset(asset: Asset): AssetValuation {
  const costBasis = sumMoney([asset.purchaseAmount, asset.extraCost]);
  const worth = assetWorth(asset);
  const gain = worth == null ? null : sumMoney([worth, -costBasis]);
  const gainPct =
    gain == null || costBasis <= 0 ? null : roundMoney((gain / costBasis) * 100);
  return { asset, costBasis, worth, gain, gainPct };
}

export interface AssetsOverview {
  valuations: AssetValuation[];
  totalCost: number;
  /** Sum of current worth across assets that have a valuation. */
  totalWorth: number;
  totalGain: number;
  totalGainPct: number;
  /** True when at least one asset still has no current price/value set. */
  hasUnvalued: boolean;
}

export function summarizeAssets(assets: Asset[]): AssetsOverview {
  const valuations = assets.map(valueAsset);
  // Only assets with a known worth contribute to the totals, so an unpriced
  // asset doesn't silently read as a total loss.
  const valued = valuations.filter((v) => v.worth != null);
  const totalCost = sumMoney(valued.map((v) => v.costBasis));
  const totalWorth = sumMoney(valued.map((v) => v.worth as number));
  const totalGain = sumMoney([totalWorth, -totalCost]);
  const totalGainPct = totalCost > 0 ? roundMoney((totalGain / totalCost) * 100) : 0;
  return {
    valuations,
    totalCost,
    totalWorth,
    totalGain,
    totalGainPct,
    hasUnvalued: valuations.some((v) => v.worth == null),
  };
}
