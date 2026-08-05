"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Layers, Plus, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPanel, StatCardsSkeleton } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { MonthSwitcher } from "@/components/shared/period-controls";
import { Button } from "@/components/ui/button";
import { CashflowChart, type CashflowPoint } from "@/components/charts/cashflow-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { TransactionList } from "@/components/transactions/transaction-list";
import { byCategory, dailySeries, pctChange, totals } from "@/lib/analytics";
import { monthRange, shiftMonthRange, type DateRange } from "@/lib/dates";
import { useCategories, useMoney, useSettings, useTransactions } from "@/lib/hooks/use-data";
import { useQuickAdd } from "@/stores/ui-store";
import type { TxType } from "@/lib/types";

interface LedgerViewProps {
  type: TxType;
}

const COPY: Record<
  TxType,
  {
    title: string;
    description: string;
    addLabel: string;
    icon: typeof TrendingUp;
    accent: "income" | "expense";
    totalLabel: string;
    emptyTitle: string;
    emptyDescription: string;
  }
> = {
  income: {
    title: "Income",
    description: "Every payday, gift, and side hustle — tracked in one place.",
    addLabel: "Add income",
    icon: TrendingUp,
    accent: "income",
    totalLabel: "Total income",
    emptyTitle: "No income recorded yet",
    emptyDescription: "Log your first paycheck or payment to start building this month's picture.",
  },
  expense: {
    title: "Expenses",
    description: "Every bill, purchase, and subscription — tracked in one place.",
    addLabel: "Add expense",
    icon: TrendingDown,
    accent: "expense",
    totalLabel: "Total expenses",
    emptyTitle: "No expenses recorded yet",
    emptyDescription: "Log your first purchase or bill to start building this month's picture.",
  },
};

export function LedgerView({ type }: LedgerViewProps) {
  const copy = COPY[type];
  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  const openCreate = useQuickAdd((s) => s.openCreate);
  const { fmt } = useMoney();

  const [range, setRange] = useState<DateRange>(() => monthRange(new Date(), settings?.monthStartDay ?? 1));
  const prevRange = useMemo(() => shiftMonthRange(range, -1, monthStartDay), [range, monthStartDay]);

  const txs = useTransactions({ range, types: [type] });
  const prevTxs = useTransactions({ range: prevRange, types: [type] });
  const categories = useCategories();

  const isLoading = txs === undefined || prevTxs === undefined || categories === undefined;

  const view = useMemo(() => {
    if (!txs || !prevTxs || !categories) return null;

    const t = totals(txs);
    const pt = totals(prevTxs);
    const currentValue = type === "income" ? t.income : t.expense;
    const previousValue = type === "income" ? pt.income : pt.expense;

    const slices = byCategory(txs, categories, type);
    const topSlice = slices[0];
    const average = t.count > 0 ? currentValue / t.count : 0;

    const daily: CashflowPoint[] = dailySeries(txs, range).map((d) => ({
      label: format(parseISO(d.date), "d"),
      income: d.income,
      expense: d.expense,
    }));

    return {
      currentValue,
      delta: pctChange(currentValue, previousValue),
      count: t.count,
      average,
      slices,
      topSlice,
      daily,
    };
  }, [txs, prevTxs, categories, range, type]);

  const isEmpty = view !== null && view.count === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <MonthSwitcher range={range} onChange={setRange} monthStartDay={monthStartDay} />
            <Button className="gap-2" onClick={() => openCreate(type)}>
              <Plus className="size-4" /> {copy.addLabel}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <LoadingPanel rows={4} />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={copy.icon}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={
            <Button className="gap-2" onClick={() => openCreate(type)}>
              <Plus className="size-4" /> {copy.addLabel}
            </Button>
          }
        />
      ) : view ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={copy.totalLabel}
              icon={type === "income" ? ArrowDownLeft : ArrowUpRight}
              accent={copy.accent}
              value={<Money amount={view.currentValue} tone={type} />}
              delta={view.delta}
              invertDelta={type === "expense"}
              hint="vs. last month"
            />
            <StatCard
              label="Transactions"
              icon={Receipt}
              accent="chart-2"
              value={<span className="tabular-nums">{view.count}</span>}
            />
            <StatCard
              label="Average per transaction"
              icon={Layers}
              accent="chart-3"
              value={<Money amount={view.average} />}
            />
            <StatCard
              label="Top category"
              icon={copy.icon}
              accent={copy.accent}
              value={view.topSlice ? (view.topSlice.category?.name ?? "Uncategorized") : "None"}
              hint={view.topSlice ? fmt(view.topSlice.total) : "No categorized activity"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <SectionCard
              title="Breakdown by category"
              description={`Where your ${type} comes from`}
              className="lg:col-span-2"
            >
              {view.slices.length ? (
                <CategoryDonut slices={view.slices} total={view.currentValue} centerLabel="Total" />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No categorized {type} yet this month.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Trend" description="Daily activity this month" className="lg:col-span-3">
              <CashflowChart data={view.daily} variant="area" series={[type]} />
            </SectionCard>
          </div>

          <SectionCard title={`All ${type}`} description="Every transaction this month">
            <TransactionList transactions={txs} categories={categories} grouped />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
