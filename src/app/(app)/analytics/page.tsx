"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  PiggyBank,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPanel, StatCardsSkeleton } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { CategoryIcon } from "@/components/shared/category-icon";
import { PresetSelect } from "@/components/shared/period-controls";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { MethodBreakdown } from "@/components/charts/method-breakdown";
import {
  byCategory,
  byMethod,
  monthlySeries,
  savingsRate,
  topTransactions,
  totals,
} from "@/lib/analytics";
import { monthKeyLabel, presetRange, rangeDays, type PresetKey } from "@/lib/dates";
import { formatDate, formatPercent } from "@/lib/format";
import {
  useCategories,
  useMoney,
  useSettings,
  useTransactionCount,
  useTransactions,
} from "@/lib/hooks/use-data";
import type { Category, Transaction, TxType } from "@/lib/types";

function TopTransactionRow({ tx, category, type }: { tx: Transaction; category?: Category; type: TxType }) {
  const note = tx.note?.trim();
  const primary = note || category?.name || "Uncategorized";
  const secondary = note
    ? `${category?.name ?? "Uncategorized"} · ${formatDate(tx.date, "short")}`
    : formatDate(tx.date, "short");

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <CategoryIcon icon={category?.icon ?? "ReceiptText"} color={category?.color ?? "chart-2"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <Money amount={tx.amount} tone={type} className="shrink-0 text-sm font-semibold" />
    </li>
  );
}

export default function AnalyticsPage() {
  const [presetKey, setPresetKey] = useState<PresetKey>("last-3-months");
  const settings = useSettings();
  const { fmt } = useMoney();
  const range = useMemo(
    () => presetRange(presetKey, new Date(), settings?.monthStartDay ?? 1),
    [presetKey, settings?.monthStartDay],
  );

  const txs = useTransactions({ range });
  // Include archived categories so historical breakdowns keep real labels/icons.
  const categories = useCategories(true);
  const totalCount = useTransactionCount();

  const categoryMap = useMemo(
    () => new Map<string, Category>((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const view = useMemo(() => {
    if (!txs || !categories) return null;

    const t = totals(txs);
    const rate = savingsRate(t);
    const monthly = monthlySeries(txs, range).map((m) => ({
      label: m.label,
      income: m.income,
      expense: m.expense,
    }));
    const expenseSlices = byCategory(txs, categories, "expense");
    const incomeSlices = byCategory(txs, categories, "income");
    const methodSlices = byMethod(txs);
    const topExpenses = topTransactions(txs, "expense", 5);
    const topIncome = topTransactions(txs, "income", 5);

    // Average over the actual span of recorded data, not the raw preset window
    // (otherwise "All time" divides by ~20,000 days back to 1970).
    const txDates = txs.map((tx) => tx.date).sort();
    const days = txDates.length
      ? rangeDays({ start: txDates[0], end: txDates[txDates.length - 1] })
      : 0;
    const avgDailySpend = days > 0 ? t.expense / days : 0;

    const monthCounts = new Map<string, number>();
    for (const tx of txs) {
      const key = tx.date.slice(0, 7);
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
    let busiestMonth: string | null = null;
    let busiestCount = 0;
    for (const [key, count] of monthCounts) {
      if (count > busiestCount) {
        busiestCount = count;
        busiestMonth = key;
      }
    }

    const insights: string[] = [];
    if (expenseSlices.length > 0) {
      const top = expenseSlices[0];
      insights.push(
        `${top.category?.name ?? "Uncategorized"} is your biggest spending category, making up ${formatPercent(top.pct)} of your expenses.`,
      );
    }
    if (t.expense > 0 && days > 0) {
      insights.push(`You're spending an average of ${fmt(avgDailySpend)} per day over this period.`);
    }
    if (t.income > 0) {
      if (rate >= 20) {
        insights.push(`Great job — you're saving ${formatPercent(rate)} of your income, a healthy savings rate.`);
      } else if (rate >= 0) {
        insights.push(`You're saving ${formatPercent(rate)} of your income. There's room to build a stronger buffer.`);
      } else {
        insights.push(`You spent more than you earned this period, ending ${formatPercent(Math.abs(rate))} in the red relative to income.`);
      }
    } else if (t.expense > 0) {
      insights.push("No income was recorded in this period, so all spending came out of savings.");
    }
    if (busiestMonth && busiestCount > 0) {
      insights.push(`${monthKeyLabel(busiestMonth)} was your busiest month, with ${busiestCount} transaction${busiestCount === 1 ? "" : "s"} logged.`);
    }

    return {
      t,
      rate,
      monthly,
      expenseSlices,
      incomeSlices,
      methodSlices,
      topExpenses,
      topIncome,
      avgDailySpend,
      insights,
    };
  }, [txs, categories, range, fmt]);

  const ready = txs !== undefined && categories !== undefined && settings !== undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Understand where your money comes from and where it goes."
        actions={<PresetSelect value={presetKey} onChange={setPresetKey} />}
      />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={4} />
          <LoadingPanel rows={4} />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to analyze yet"
          description="Add a few transactions first — your income, spending trends, and breakdowns will show up here."
        />
      ) : view ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total income"
              icon={ArrowDownLeft}
              accent="income"
              value={<Money amount={view.t.income} />}
            />
            <StatCard
              label="Total expenses"
              icon={ArrowUpRight}
              accent="expense"
              value={<Money amount={view.t.expense} />}
            />
            <StatCard
              label="Net"
              icon={Scale}
              accent="chart-4"
              value={<Money amount={view.t.net} tone="net" />}
            />
            <StatCard
              label="Savings rate"
              icon={PiggyBank}
              accent="savings"
              value={<span className="tabular-nums">{formatPercent(view.rate)}</span>}
            />
          </div>

          <SectionCard title="Income vs. expenses" description="Monthly totals for the selected period">
            {view.monthly.length > 0 ? (
              <CashflowChart data={view.monthly} variant="bar" height={300} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No data in this period.</p>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Spending by category">
              {view.expenseSlices.length > 0 ? (
                <CategoryDonut slices={view.expenseSlices} total={view.t.expense} centerLabel="Spent" />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No expenses recorded in this period.
                </p>
              )}
            </SectionCard>
            <SectionCard title="Income by source">
              {view.incomeSlices.length > 0 ? (
                <CategoryDonut slices={view.incomeSlices} total={view.t.income} centerLabel="Earned" />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No income recorded in this period.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Payment methods" description="How you paid for expenses">
            {view.methodSlices.length > 0 ? (
              <MethodBreakdown data={view.methodSlices} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expense transactions in this period.
              </p>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Largest expenses">
              {view.topExpenses.length > 0 ? (
                <ul className="divide-y divide-border">
                  {view.topExpenses.map((tx) => (
                    <TopTransactionRow
                      key={tx.id}
                      tx={tx}
                      category={categoryMap.get(tx.categoryId)}
                      type="expense"
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No expenses recorded in this period.
                </p>
              )}
            </SectionCard>
            <SectionCard title="Largest income">
              {view.topIncome.length > 0 ? (
                <ul className="divide-y divide-border">
                  {view.topIncome.map((tx) => (
                    <TopTransactionRow
                      key={tx.id}
                      tx={tx}
                      category={categoryMap.get(tx.categoryId)}
                      type="income"
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No income recorded in this period.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Insights" description="Auto-generated highlights from this period">
            {view.insights.length > 0 ? (
              <ul className="space-y-3">
                {view.insights.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: "var(--chart-1)" }}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Not enough data yet to generate insights.
              </p>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
