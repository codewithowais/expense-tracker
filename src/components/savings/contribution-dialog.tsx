"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/shared/money-input";
import { DateField } from "@/components/shared/date-field";
import { contributionRepo } from "@/lib/repositories/savings";
import { contributionSchema, type ContributionFormValues } from "@/lib/schemas";
import { todayISO } from "@/lib/format";
import { useSavingsGoals } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";
import type { SavingsContribution } from "@/lib/types";

type ContributionMode = "add" | "withdraw";

interface ContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this contribution instead of creating one. */
  contribution?: SavingsContribution;
  /** Lock the goal to this id and hide the goal picker. */
  presetGoalId?: string;
  /** Preselect Add vs Withdraw when creating a new entry. */
  initialMode?: ContributionMode;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

/** Create/edit dialog for a savings contribution or withdrawal. */
export function ContributionDialog({
  open,
  onOpenChange,
  contribution,
  presetGoalId,
  initialMode,
}: ContributionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {open ? (
          <ContributionDialogForm
            key={`${contribution?.id ?? "new"}-${presetGoalId ?? ""}-${initialMode ?? ""}`}
            contribution={contribution}
            presetGoalId={presetGoalId}
            initialMode={initialMode}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface ContributionDialogFormProps {
  contribution?: SavingsContribution;
  presetGoalId?: string;
  initialMode?: ContributionMode;
  onDone: () => void;
  onCancel: () => void;
}

function ContributionDialogForm({
  contribution,
  presetGoalId,
  initialMode,
  onDone,
  onCancel,
}: ContributionDialogFormProps) {
  const goals = useSavingsGoals();
  const isEdit = Boolean(contribution);
  const lockedGoalId = presetGoalId ?? contribution?.goalId;
  const showGoalField = !presetGoalId;

  const [mode, setMode] = useState<ContributionMode>(
    contribution ? (contribution.amount < 0 ? "withdraw" : "add") : (initialMode ?? "add"),
  );

  const goalOptions = useMemo(() => goals ?? [], [goals]);
  const lockedGoal = useMemo(
    () => goalOptions.find((g) => g.id === lockedGoalId),
    [goalOptions, lockedGoalId],
  );

  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      goalId: contribution?.goalId ?? presetGoalId ?? "",
      // The field always holds a positive, typed amount; sign is derived from `mode` on submit.
      amount: contribution ? Math.abs(contribution.amount) : (undefined as unknown as number),
      note: contribution?.note ?? "",
      date: contribution?.date ?? todayISO(),
    },
  });

  async function onSubmit(values: ContributionFormValues) {
    const signedAmount = mode === "withdraw" ? -Math.abs(values.amount) : Math.abs(values.amount);
    const payload = {
      goalId: values.goalId,
      amount: signedAmount,
      note: values.note ?? "",
      date: values.date,
    };
    try {
      if (contribution) {
        await contributionRepo.update(contribution.id, payload);
        toast.success("Contribution updated");
      } else {
        await contributionRepo.create(payload);
        toast.success(mode === "withdraw" ? "Withdrawal recorded" : "Contribution added");
      }
      onDone();
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit contribution" : "Add contribution"}</DialogTitle>
        <DialogDescription>
          {showGoalField
            ? "Log money added to or withdrawn from a savings goal."
            : `Log an entry for ${lockedGoal?.name ?? "this goal"}.`}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {showGoalField ? (
          <div className="space-y-1.5">
            <Label htmlFor="contribution-goal">Goal</Label>
            <Controller
              control={control}
              name="goalId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="contribution-goal"
                    className="w-full"
                    aria-invalid={!!errors.goalId}
                  >
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalOptions.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                    {goalOptions.length === 0 ? (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No goals yet
                      </div>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
            />
            {fieldError(errors.goalId?.message)}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>Type</Label>
          <div
            role="radiogroup"
            aria-label="Contribution type"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === "add"}
              onClick={() => setMode("add")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
                mode === "add"
                  ? "bg-income-soft text-income shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpCircle className="size-4" /> Add
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "withdraw"}
              onClick={() => setMode("withdraw")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
                mode === "withdraw"
                  ? "bg-expense-soft text-expense shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowDownCircle className="size-4" /> Withdraw
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contribution-amount">Amount</Label>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="contribution-amount"
                size="md"
                value={field.value ?? null}
                onChange={(n) => field.onChange(n ?? undefined)}
                aria-invalid={!!errors.amount}
                autoFocus={!showGoalField}
              />
            )}
          />
          {fieldError(errors.amount?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contribution-date">Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                id="contribution-date"
                value={field.value}
                onChange={field.onChange}
                disableFuture
                aria-invalid={!!errors.date}
              />
            )}
          />
          {fieldError(errors.date?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contribution-note">Note (optional)</Label>
          <Input
            id="contribution-note"
            placeholder="What was this for?"
            {...register("note")}
            aria-invalid={!!errors.note}
          />
          {fieldError(errors.note?.message)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : mode === "withdraw" ? "Record withdrawal" : "Add contribution"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
