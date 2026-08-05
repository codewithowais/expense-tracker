import { sumMoney } from "./format";
import { daysInRange, monthKey, monthKeyLabel, monthsInRange, type DateRange } from "./dates";
import type { Budget, Category, Transaction } from "./types";

export interface Totals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function totals(txs: Transaction[]): Totals {
  const income = sumMoney(txs.filter((t) => t.type === "income").map((t) => t.amount));
  const expense = sumMoney(txs.filter((t) => t.type === "expense").map((t) => t.amount));
  return { income, expense, net: sumMoney([income, -expense]), count: txs.length };
}

export function savingsRate(t: Totals): number {
  if (t.income <= 0) return 0;
  return Math.max(-999, Math.min(100, (t.net / t.income) * 100));
}

export interface CategorySlice {
  category: Category | undefined;
  categoryId: string;
  total: number;
  count: number;
  pct: number;
}

export function byCategory(
  txs: Transaction[],
  categories: Category[],
  type: "income" | "expense",
): CategorySlice[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const cur = map.get(t.categoryId) ?? { total: 0, count: 0 };
    cur.total = sumMoney([cur.total, t.amount]);
    cur.count += 1;
    map.set(t.categoryId, cur);
  }
  const grand = sumMoney([...map.values()].map((v) => v.total));
  const catById = new Map(categories.map((c) => [c.id, c]));
  return [...map.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      category: catById.get(categoryId),
      total: v.total,
      count: v.count,
      pct: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface DailyPoint {
  date: string;
  income: number;
  expense: number;
  net: number;
}

/** Dense daily series (zero-filled) — good for area/bar trend charts. */
export function dailySeries(txs: Transaction[], range: DateRange): DailyPoint[] {
  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const t of txs) {
    const m = t.type === "income" ? inc : exp;
    m.set(t.date, sumMoney([m.get(t.date) ?? 0, t.amount]));
  }
  return daysInRange(range).map((date) => {
    const income = inc.get(date) ?? 0;
    const expense = exp.get(date) ?? 0;
    return { date, income, expense, net: sumMoney([income, -expense]) };
  });
}

export interface MonthlyPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export function monthlySeries(txs: Transaction[], range: DateRange): MonthlyPoint[] {
  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const t of txs) {
    const key = monthKey(t.date);
    const m = t.type === "income" ? inc : exp;
    m.set(key, sumMoney([m.get(key) ?? 0, t.amount]));
  }
  return monthsInRange(range).map((iso) => {
    const key = monthKey(iso);
    const income = inc.get(key) ?? 0;
    const expense = exp.get(key) ?? 0;
    return { key, label: monthKeyLabel(key), income, expense, net: sumMoney([income, -expense]) };
  });
}

export interface MethodSlice {
  method: string;
  total: number;
  count: number;
  pct: number;
}

export function byMethod(txs: Transaction[]): MethodSlice[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const cur = map.get(t.method) ?? { total: 0, count: 0 };
    cur.total = sumMoney([cur.total, t.amount]);
    cur.count += 1;
    map.set(t.method, cur);
  }
  const grand = sumMoney([...map.values()].map((v) => v.total));
  return [...map.entries()]
    .map(([method, v]) => ({ method, total: v.total, count: v.count, pct: grand ? (v.total / grand) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

export type BudgetStatus = "under" | "warning" | "over";

export interface BudgetProgress {
  budget: Budget;
  category: Category | undefined;
  label: string;
  spent: number;
  limit: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
}

/** Compute spend vs. limit for each budget within `monthTxs`. */
export function budgetProgress(
  budgets: Budget[],
  monthTxs: Transaction[],
  categories: Category[],
): BudgetProgress[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const expenses = monthTxs.filter((t) => t.type === "expense");
  const totalExpense = sumMoney(expenses.map((t) => t.amount));

  return budgets
    .map((budget) => {
      let spent = 0;
      let label = "Overall spending";
      let category: Category | undefined;
      if (budget.scope === "overall") {
        spent = totalExpense;
      } else {
        category = catById.get(budget.categoryId ?? "");
        spent = sumMoney(expenses.filter((t) => t.categoryId === budget.categoryId).map((t) => t.amount));
        label = category?.name ?? "Category";
      }
      const limit = budget.amount;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const status: BudgetStatus = pct >= 100 ? "over" : pct >= 80 ? "warning" : "under";
      return {
        budget,
        category,
        label,
        spent,
        limit,
        remaining: sumMoney([limit, -spent]),
        pct,
        status,
      };
    })
    .sort((a, b) => (a.budget.scope === "overall" ? -1 : b.budget.scope === "overall" ? 1 : b.pct - a.pct));
}

export function topTransactions(txs: Transaction[], type: "expense" | "income", n = 5): Transaction[] {
  return txs
    .filter((t) => t.type === type)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

/** Percentage change helper; returns null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
