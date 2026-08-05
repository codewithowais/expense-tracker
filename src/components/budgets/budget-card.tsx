"use client";

import { useState } from "react";
import { MoreVertical, Pencil, PiggyBank, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
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
import { budgetRepo } from "@/lib/repositories/budgets";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@/lib/analytics";
import type { Budget } from "@/lib/types";

interface BudgetCardProps {
  progress: BudgetProgress;
  onEdit: (budget: Budget) => void;
  className?: string;
}

const STATUS_STYLES = {
  under: { bar: "bg-income", text: "text-income" },
  warning: { bar: "bg-savings", text: "text-savings" },
  over: { bar: "bg-expense", text: "text-expense" },
} as const;

/** A single budget's progress: label, spent/limit, colored bar, and edit/delete actions. */
export function BudgetCard({ progress, onEdit, className }: BudgetCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { budget, category, label, spent, limit, remaining, pct, status } = progress;
  const style = STATUS_STYLES[status];
  const isOver = status === "over";
  const clampedPct = Math.min(100, Math.max(0, pct));

  async function handleDelete() {
    setDeleting(true);
    try {
      await budgetRepo.remove(budget.id);
      toast.success("Budget removed");
      setConfirmOpen(false);
    } catch {
      toast.error("Couldn’t remove the budget. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className={cn("card-elevated gap-0 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {category ? (
            <CategoryIcon icon={category.icon} color={category.color} size="md" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <PiggyBank className="size-[1.15rem]" strokeWidth={2} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">
              <Money amount={spent} /> of <Money amount={limit} />
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${label} budget`}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(budget)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(clampedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} budget usage`}
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", style.bar)}
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium", style.text)}>
          {isOver ? (
            <>
              Over by <Money amount={Math.abs(remaining)} />
            </>
          ) : (
            <>
              <Money amount={remaining} /> remaining
            </>
          )}
        </span>
        <span className={cn("tabular-nums", isOver ? style.text : "text-muted-foreground")}>
          {formatPercent(pct, 0)}
        </span>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {label} limit. You can set a new one again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
