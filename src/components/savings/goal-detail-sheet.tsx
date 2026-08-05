"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { GoalDialog } from "./goal-dialog";
import { ContributionDialog } from "./contribution-dialog";
import { savingsGoalRepo, contributionRepo } from "@/lib/repositories/savings";
import { summarizeGoals } from "@/lib/savings";
import { formatDate, formatPercent } from "@/lib/format";
import { useContributionsByGoal, useSavingsGoals } from "@/lib/hooks/use-data";
import type { SavingsContribution } from "@/lib/types";

interface GoalDetailSheetProps {
  goalId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Detail sheet for a single savings goal: progress, quick actions, and full contribution history. */
export function GoalDetailSheet({ goalId, onOpenChange }: GoalDetailSheetProps) {
  const goals = useSavingsGoals();
  const contributions = useContributionsByGoal(goalId ?? "");
  const goal = useMemo(() => goals?.find((g) => g.id === goalId), [goals, goalId]);

  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [deleteGoalOpen, setDeleteGoalOpen] = useState(false);
  const [contributionDialog, setContributionDialog] = useState<{
    contribution?: SavingsContribution;
  } | null>(null);
  const [pendingDeleteContribution, setPendingDeleteContribution] =
    useState<SavingsContribution | null>(null);

  const open = goalId !== null;

  const progress = useMemo(() => {
    if (!goal) return null;
    return summarizeGoals([goal], contributions ?? []).progress[0] ?? null;
  }, [goal, contributions]);

  async function confirmDeleteGoal() {
    if (!goal) return;
    await savingsGoalRepo.remove(goal.id);
    setDeleteGoalOpen(false);
    toast.success("Goal deleted");
    onOpenChange(false);
  }

  async function confirmDeleteContribution() {
    if (!pendingDeleteContribution) return;
    await contributionRepo.remove(pendingDeleteContribution.id);
    setPendingDeleteContribution(null);
    toast.success("Contribution deleted");
  }

  const clampedPct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          {goal && progress ? (
            <>
              <SheetHeader className="gap-4 border-b border-border px-6 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryIcon icon={goal.icon} color={goal.color} size="lg" />
                    <div className="min-w-0 space-y-1">
                      <SheetTitle className="truncate font-heading text-xl">
                        {goal.name}
                      </SheetTitle>
                      <SheetDescription>
                        {progress.complete
                          ? "Goal reached 🎉"
                          : goal.targetDate
                            ? `Target: ${formatDate(goal.targetDate)}`
                            : "In progress"}
                      </SheetDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-lg text-muted-foreground"
                        aria-label="Goal actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditGoalOpen(true)}>
                        <Pencil className="size-4" /> Edit goal
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteGoalOpen(true)}
                      >
                        <Trash2 className="size-4" /> Delete goal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <p className="font-heading text-3xl font-semibold text-foreground">
                    <Money amount={progress.saved} /> <span className="text-lg font-normal text-muted-foreground">of <Money amount={progress.target} /></span>
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(clampedPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${goal.name} progress`}
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
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
                      {progress.complete ? (
                        "Goal reached 🎉"
                      ) : (
                        <>
                          <Money amount={progress.remaining} /> remaining
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setContributionDialog({})}
                  >
                    <ArrowUpCircle className="size-4" /> Add contribution
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setContributionDialog({})}
                  >
                    <ArrowDownCircle className="size-4" /> Withdraw
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-3 px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  History
                </h3>
                {!contributions ? null : contributions.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    No contributions yet for {goal.name}. Add one to start tracking progress.
                  </p>
                ) : (
                  <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                    {contributions.map((c, i) => (
                      <li
                        key={c.id}
                        className={
                          i > 0
                            ? "flex items-center gap-3 border-t border-border px-3 py-3 sm:px-4"
                            : "flex items-center gap-3 px-3 py-3 sm:px-4"
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {formatDate(c.date)}
                          </p>
                          {c.note ? (
                            <p className="truncate text-xs text-muted-foreground">{c.note}</p>
                          ) : null}
                        </div>
                        <Money
                          amount={Math.abs(c.amount)}
                          tone={c.amount >= 0 ? "income" : "expense"}
                          signed
                          className="text-sm font-semibold sm:text-base"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 rounded-lg text-muted-foreground"
                              aria-label="Contribution actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setContributionDialog({ contribution: c })}>
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteContribution(c)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {goal ? (
        <GoalDialog open={editGoalOpen} onOpenChange={setEditGoalOpen} goal={goal} />
      ) : null}

      {goal ? (
        <ContributionDialog
          open={contributionDialog !== null}
          onOpenChange={(v) => !v && setContributionDialog(null)}
          contribution={contributionDialog?.contribution}
          presetGoalId={goal.id}
        />
      ) : null}

      <AlertDialog open={deleteGoalOpen} onOpenChange={setDeleteGoalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {goal?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the goal and its entire contribution history. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGoal}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteContribution !== null}
        onOpenChange={(v) => !v && setPendingDeleteContribution(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contribution?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from {goal?.name ?? "this goal"}’s history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteContribution}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
