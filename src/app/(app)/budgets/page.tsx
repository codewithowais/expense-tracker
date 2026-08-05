"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, PiggyBank, Plus, Target, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCardsSkeleton, LoadingPanel } from "@/components/shared/states";
import { MonthSwitcher } from "@/components/shared/period-controls";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { BudgetCard } from "@/components/budgets/budget-card";
import { budgetProgress } from "@/lib/analytics";
import { monthRange, type DateRange } from "@/lib/dates";
import { formatPercent, sumMoney } from "@/lib/format";
import { useBudgets, useCategories, useSettings, useTransactions } from "@/lib/hooks/use-data";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  // `null` until the user navigates — so the default range follows the real
  // salary-cycle start day once settings resolve (they load asynchronously).
  const [userRange, setRange] = useState<DateRange | null>(null);
  const range = useMemo(
    () => userRange ?? monthRange(new Date(), monthStartDay),
    [userRange, monthStartDay],
  );

  const budgets = useBudgets();
  // Include archived categories so a budget's label/icon survives archiving.
  const categories = useCategories(true);
  const txs = useTransactions({ range });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);

  const ready = Boolean(budgets && categories && txs);

  const rows = useMemo(() => {
    if (!budgets || !categories || !txs) return null;
    return budgetProgress(budgets, txs, categories);
  }, [budgets, categories, txs]);

  const overallRow = rows?.find((r) => r.budget.scope === "overall");
  const categoryRows = useMemo(
    () => rows?.filter((r) => r.budget.scope === "category") ?? [],
    [rows],
  );

  const expenseCategoryCount = useMemo(
    () => (categories ?? []).filter((c) => c.type === "expense").length,
    [categories],
  );

  const overCount = rows?.filter((r) => r.status === "over").length ?? 0;
  const nearCount = rows?.filter((r) => r.status === "warning").length ?? 0;

  const totalBudgeted = overallRow ? overallRow.limit : sumMoney(categoryRows.map((r) => r.limit));
  const totalSpent = overallRow ? overallRow.spent : sumMoney(categoryRows.map((r) => r.spent));
  const spentPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const canAddCategoryBudget = categoryRows.length < expenseCategoryCount;
  const canCreateBudget = !overallRow || canAddCategoryBudget;

  function openCreate() {
    setEditingBudget(undefined);
    setDialogOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget);
    setDialogOpen(true);
  }

  function handleDialogChange(next: boolean) {
    setDialogOpen(next);
    if (!next) setEditingBudget(undefined);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set monthly limits and track spending against them."
        actions={
          <Button
            className="gap-2"
            onClick={openCreate}
            disabled={!ready || !canCreateBudget}
            title={ready && !canCreateBudget ? "Every category already has a budget" : undefined}
          >
            <Plus className="size-4" /> New budget
          </Button>
        }
      />

      <MonthSwitcher range={range} onChange={setRange} monthStartDay={monthStartDay} />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={3} />
          <LoadingPanel rows={4} />
        </div>
      ) : budgets && budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Create your first budget to start tracking spending limits against your categories."
          action={
            <div className="flex flex-col items-center gap-3">
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="size-4" /> Create your first budget
              </Button>
              <p className="max-w-sm text-xs text-muted-foreground">
                Budgets reset automatically at the start of each month, so you always track spending
                fresh.
              </p>
            </div>
          }
        />
      ) : rows ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Budgeted this month"
              icon={Target}
              accent="chart-1"
              value={<Money amount={totalBudgeted} />}
              hint={
                overallRow
                  ? "Overall limit"
                  : `${categoryRows.length} ${categoryRows.length === 1 ? "category" : "categories"}`
              }
            />
            <StatCard
              label="Spent this month"
              icon={Wallet}
              accent={spentPct >= 100 ? "expense" : spentPct >= 80 ? "savings" : "income"}
              value={<Money amount={totalSpent} />}
              hint={`${formatPercent(spentPct, 0)} of budget used`}
            />
            <StatCard
              label="Needs attention"
              icon={AlertTriangle}
              accent={overCount > 0 ? "expense" : nearCount > 0 ? "savings" : "income"}
              value={<span className="tabular-nums">{overCount + nearCount}</span>}
              hint={`${overCount} over · ${nearCount} near limit`}
            />
          </div>

          {overallRow ? <BudgetCard progress={overallRow} onEdit={openEdit} /> : null}

          {categoryRows.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categoryRows.map((row) => (
                <BudgetCard key={row.budget.id} progress={row} onEdit={openEdit} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">No category budgets yet.</p>
              {canAddCategoryBudget ? (
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openCreate}>
                  <Plus className="size-4" /> Add a category budget
                </Button>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      <BudgetDialog open={dialogOpen} onOpenChange={handleDialogChange} budget={editingBudget} />
    </div>
  );
}
