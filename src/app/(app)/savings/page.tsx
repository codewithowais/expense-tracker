"use client";

import { useMemo, useState } from "react";
import { PiggyBank, Plus, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCardsSkeleton, LoadingPanel } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Button } from "@/components/ui/button";
import { GoalDialog } from "@/components/savings/goal-dialog";
import { ContributionDialog } from "@/components/savings/contribution-dialog";
import { GoalDetailSheet } from "@/components/savings/goal-detail-sheet";
import { summarizeGoals } from "@/lib/savings";
import { formatPercent } from "@/lib/format";
import { useSavingsContributions, useSavingsGoals } from "@/lib/hooks/use-data";

export default function SavingsPage() {
  const goals = useSavingsGoals();
  const contributions = useSavingsContributions();
  const ready = Boolean(goals && contributions);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const { progress, totalSaved, totalTarget, overallPct } = useMemo(
    () => summarizeGoals(goals ?? [], contributions ?? []),
    [goals, contributions],
  );

  const hasGoals = (goals?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        description="Set goals and watch your savings grow."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setContributionDialogOpen(true)}
              disabled={!ready || !hasGoals}
              title={ready && !hasGoals ? "Create a goal first" : undefined}
            >
              <Plus className="size-4" /> Add contribution
            </Button>
            <Button className="gap-2" onClick={() => setGoalDialogOpen(true)}>
              <Plus className="size-4" /> New goal
            </Button>
          </>
        }
      />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={3} />
          <LoadingPanel rows={4} />
        </div>
      ) : !hasGoals ? (
        <EmptyState
          icon={Target}
          title="No savings goals yet"
          description="Create a goal like an emergency fund or a big purchase, then log contributions as you save toward it."
          action={
            <Button className="gap-2" onClick={() => setGoalDialogOpen(true)}>
              <Plus className="size-4" /> New goal
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total saved"
              icon={PiggyBank}
              accent="income"
              value={<Money amount={totalSaved} tone="income" />}
            />
            <StatCard
              label="Total target"
              icon={Target}
              accent="chart-4"
              value={<Money amount={totalTarget} />}
            />
            <StatCard
              label="Overall progress"
              icon={TrendingUp}
              accent="chart-2"
              value={formatPercent(overallPct)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {progress.map(({ goal, saved, target, remaining, pct, complete }) => {
              const clampedPct = Math.min(100, Math.max(0, pct));
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoalId(goal.id)}
                  className="card-interactive flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-accent/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon icon={goal.icon} color={goal.color} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{goal.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <Money amount={saved} /> of <Money amount={target} />
                        </p>
                      </div>
                    </div>
                    {complete ? (
                      <span className="shrink-0 rounded-full bg-income-soft px-2 py-0.5 text-[0.7rem] font-medium text-income">
                        Reached
                      </span>
                    ) : null}
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(clampedPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${goal.name} progress`}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${clampedPct}%`, backgroundColor: `var(--${goal.color})` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium tabular-nums" style={{ color: `var(--${goal.color})` }}>
                      {formatPercent(clampedPct, 0)}
                    </span>
                    <span>
                      {complete ? (
                        "Goal reached 🎉"
                      ) : (
                        <>
                          <Money amount={remaining} /> left
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <GoalDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen} />
      <ContributionDialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen} />
      <GoalDetailSheet
        goalId={selectedGoalId}
        onOpenChange={(v) => !v && setSelectedGoalId(null)}
      />
    </div>
  );
}
