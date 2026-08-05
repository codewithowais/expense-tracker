import { roundMoney, sumMoney } from "./format";
import { rangeDays, type DateRange } from "./dates";
import { savingsRate, totals } from "./analytics";
import type { Transaction, TxType } from "./types";

/** Stable identifiers for each report type in the hub. */
export const REPORT_IDS = [
  "summary",
  "categories",
  "trend",
  "people",
  "savings",
  "transactions",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

export interface PeriodStats {
  income: number;
  expense: number;
  net: number;
  /** Total transaction count in the period. */
  count: number;
  incomeCount: number;
  expenseCount: number;
  /** Net as a share of income, clamped (see analytics.savingsRate). */
  rate: number;
  /** Inclusive number of days spanned by the range. */
  days: number;
  /** Mean expense value per transaction. */
  avgExpenseSize: number;
  /** Mean income value per transaction. */
  avgIncomeSize: number;
  /** Mean spend per calendar day across the period. */
  avgExpensePerDay: number;
}

/**
 * Headline figures for the period summary report. Reuses the shared `totals`
 * and `savingsRate` helpers and layers per-transaction / per-day averages on
 * top so the summary view stays a pure read of existing aggregates.
 */
export function periodStats(txs: Transaction[], range: DateRange): PeriodStats {
  const t = totals(txs);
  const incomeCount = txs.filter((x) => x.type === "income").length;
  const expenseCount = txs.filter((x) => x.type === "expense").length;
  const days = Math.max(1, rangeDays(range));
  return {
    income: t.income,
    expense: t.expense,
    net: t.net,
    count: t.count,
    incomeCount,
    expenseCount,
    rate: savingsRate(t),
    days,
    avgExpenseSize: expenseCount > 0 ? roundMoney(t.expense / expenseCount) : 0,
    avgIncomeSize: incomeCount > 0 ? roundMoney(t.income / incomeCount) : 0,
    avgExpensePerDay: roundMoney(t.expense / days),
  };
}

export interface MerchantSlice {
  /** Normalized grouping key (lower-cased note, or a sentinel for blanks). */
  key: string;
  /** Display name — the original note text, or "Untitled" when blank. */
  name: string;
  total: number;
  count: number;
  /** Share of the type's total spend/earn, 0–100. */
  pct: number;
}

/**
 * Group transactions of a given type by their note ("merchant"), summing the
 * amount and counting occurrences. Blank notes collapse into a single
 * "Untitled" bucket so the report never renders an empty label.
 */
export function topMerchants(txs: Transaction[], type: TxType, n = 8): MerchantSlice[] {
  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const raw = t.note.trim();
    const key = raw ? raw.toLowerCase() : "__untitled__";
    const cur = map.get(key) ?? { name: raw || "Untitled", total: 0, count: 0 };
    cur.total = sumMoney([cur.total, t.amount]);
    cur.count += 1;
    map.set(key, cur);
  }
  const grand = sumMoney([...map.values()].map((v) => v.total));
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      total: v.total,
      count: v.count,
      pct: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}
