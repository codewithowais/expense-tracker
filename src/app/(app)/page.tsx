"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { CashflowChart, type CashflowPoint } from "@/components/charts/cashflow-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { TransactionList } from "@/components/transactions/transaction-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { StatCardsSkeleton, LoadingPanel } from "@/components/shared/states";
import { MonthSwitcher } from "@/components/shared/period-controls";
import { Button } from "@/components/ui/button";
import {
  byCategory,
  budgetProgress,
  dailySeries,
  pctChange,
  totals as computeTotals,
} from "@/lib/analytics";
import { monthRange, rangeLabel, shiftMonthRange } from "@/lib/dates";
import { generateDemoData } from "@/lib/db/seed";
import {
  useBudgets,
  useCategories,
  useDebtEntries,
  usePeople,
  useSavingsContributions,
  useSavingsGoals,
  useSettings,
  useTransactionCount,
  useTransactions,
} from "@/lib/hooks/use-data";
import { summarizePeople } from "@/lib/debts";
import { summarizeGoals } from "@/lib/savings";
import { useQuickAdd } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

export default function DashboardPage() {
  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  const [range, setRange] = useState(() => monthRange(new Date(), 1));
  const prevRange = useMemo(() => shiftMonthRange(range, -1, monthStartDay), [range, monthStartDay]);

  const openCreate = useQuickAdd((s) => s.openCreate);

  const current = useTransactions({ range });
  const previous = useTransactions({ range: prevRange });
  const categories = useCategories();
  const budgets = useBudgets();
  const totalCount = useTransactionCount();

  const ready = current && previous && categories && budgets && settings;

  const view = useMemo(() => {
    if (!current || !previous || !categories) return null;
    const t = computeTotals(current);
    const pt = computeTotals(previous);
    const expenseSlices = byCategory(current, categories, "expense");
    const daily: CashflowPoint[] = dailySeries(current, range).map((d) => ({
      label: format(parseISO(d.date), "d"),
      income: d.income,
      expense: d.expense,
    }));
    return {
      t,
      deltas: {
        income: pctChange(t.income, pt.income),
        expense: pctChange(t.expense, pt.expense),
        net: pctChange(t.net, pt.net),
      },
      expenseSlices,
      daily,
      recent: current.slice(0, 6),
    };
  }, [current, previous, categories, range]);

  const budgetRows = useMemo(() => {
    if (!budgets || !categories || !current) return [];
    return budgetProgress(budgets, current, categories).slice(0, 3);
  }, [budgets, categories, current]);

  const people = usePeople();
  const debtEntries = useDebtEntries();
  const debts = useMemo(
    () => (people && debtEntries ? summarizePeople(people, debtEntries) : null),
    [people, debtEntries],
  );

  const savingsGoals = useSavingsGoals();
  const savingsContribs = useSavingsContributions();
  const savings = useMemo(
    () => (savingsGoals && savingsContribs ? summarizeGoals(savingsGoals, savingsContribs) : null),
    [savingsGoals, savingsContribs],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting(settings?.name || undefined)}
          </h1>
          <p className="text-sm text-muted-foreground">Here’s your money at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher range={range} onChange={setRange} monthStartDay={monthStartDay} />
          <Button className="shrink-0 gap-2" onClick={() => openCreate()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      {!ready ? (
        <DashboardSkeleton />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Start tracking your money"
          description="Add your first income or expense, or load sample data to explore Ledgerly."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="gap-2" onClick={() => openCreate("expense")}>
                <Plus className="size-4" /> Add transaction
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  await generateDemoData();
                }}
              >
                <Sparkles className="size-4" /> Load sample data
              </Button>
            </div>
          }
        />
      ) : view ? (
        <>
          <BalanceHero totals={view.t} periodLabel={rangeLabel(range)} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Income"
              icon={ArrowDownLeft}
              accent="income"
              value={<Money amount={view.t.income} />}
              delta={view.deltas.income}
            />
            <StatCard
              label="Expenses"
              icon={ArrowUpRight}
              accent="expense"
              value={<Money amount={view.t.expense} />}
              delta={view.deltas.expense}
              invertDelta
            />
            <StatCard
              label="Net"
              icon={Scale}
              accent="chart-4"
              value={<Money amount={view.t.net} tone="net" />}
              delta={view.deltas.net}
            />
            <StatCard
              label="Transactions"
              icon={Receipt}
              accent="chart-2"
              value={<span className="tabular-nums">{view.t.count}</span>}
              hint={`this ${rangeLabel(range).split(" ")[0] === "All" ? "period" : "month"}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <SectionCard
              title="Cash flow"
              description="Daily income vs. spending"
              className="lg:col-span-3"
            >
              <CashflowChart data={view.daily} variant="area" />
            </SectionCard>
            <SectionCard
              title="Where it goes"
              description="Spending by category"
              className="lg:col-span-2"
              href="/analytics"
            >
              {view.expenseSlices.length ? (
                <CategoryDonut slices={view.expenseSlices} total={view.t.expense} centerLabel="Spent" />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No spending recorded this month.
                </p>
              )}
            </SectionCard>
          </div>

          {debts && debts.summaries.length > 0 && (debts.owedToYou > 0 || debts.youOwe > 0) ? (
            <SectionCard title="People & debts" href="/people" hrefLabel="Manage">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-income-soft text-income">
                    <Users className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Owed to you</p>
                    <Money amount={debts.owedToYou} tone="income" className="font-heading text-lg font-semibold" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-expense-soft text-expense">
                    <Wallet className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">You owe</p>
                    <Money amount={debts.youOwe} tone="expense" className="font-heading text-lg font-semibold" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Scale className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Net position</p>
                    <Money amount={debts.net} tone="net" className="font-heading text-lg font-semibold" />
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {savings && savings.progress.length > 0 ? (
            <SectionCard title="Savings goals" href="/savings" hrefLabel="Manage">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-income-soft text-income">
                    <Target className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Total saved</p>
                    <p className="font-heading text-lg font-semibold tabular-nums">
                      <Money amount={savings.totalSaved} />{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        of <Money amount={savings.totalTarget} />
                      </span>
                    </p>
                  </div>
                </div>
                <div className="w-full sm:max-w-xs">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Overall progress</span>
                    <span className="tabular-nums">{Math.round(savings.overallPct)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-income transition-all"
                      style={{ width: `${Math.min(100, savings.overallPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <SectionCard
              title="Budgets"
              description="This month’s limits"
              className="lg:col-span-2"
              href="/budgets"
            >
              {budgetRows.length ? (
                <ul className="space-y-4">
                  {budgetRows.map((b) => (
                    <li key={b.budget.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{b.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          <Money amount={b.spent} /> / <Money amount={b.limit} />
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            b.status === "over"
                              ? "bg-expense"
                              : b.status === "warning"
                                ? "bg-savings"
                                : "bg-income",
                          )}
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">No budgets set yet.</p>
                  <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
                    <Link href="/budgets">
                      <PiggyBank className="size-4" /> Create a budget
                    </Link>
                  </Button>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Recent activity"
              className="lg:col-span-3"
              href="/transactions"
            >
              <TransactionList transactions={view.recent} categories={categories} grouped={false} />
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 w-full animate-pulse rounded-3xl bg-muted" />
      <StatCardsSkeleton />
      <LoadingPanel rows={3} />
    </div>
  );
}
