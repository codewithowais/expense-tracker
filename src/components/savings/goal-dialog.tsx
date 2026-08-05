"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
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
import { CategoryIcon } from "@/components/shared/category-icon";
import { MoneyInput } from "@/components/shared/money-input";
import { DateField } from "@/components/shared/date-field";
import { ColorPicker } from "@/components/categories/color-picker";
import { IconPicker } from "@/components/categories/icon-picker";
import { savingsGoalRepo } from "@/lib/repositories/savings";
import { savingsGoalSchema, type SavingsGoalFormValues } from "@/lib/schemas";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { SavingsGoal } from "@/lib/types";

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this goal instead of creating one. */
  goal?: SavingsGoal;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

function defaultsFor(goal?: SavingsGoal): SavingsGoalFormValues {
  return {
    name: goal?.name ?? "",
    target: goal?.target ?? (undefined as unknown as number),
    note: goal?.note ?? "",
    color: goal?.color ?? CATEGORY_COLORS[0],
    icon: goal?.icon ?? "PiggyBank",
    targetDate: goal?.targetDate ?? null,
  };
}

/** Create/edit dialog for a savings goal: name, target, optional date, color, and icon. */
export function GoalDialog({ open, onOpenChange, goal }: GoalDialogProps) {
  const isEdit = Boolean(goal);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SavingsGoalFormValues>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: defaultsFor(goal),
  });

  // Reset only when the dialog opens or the *target* changes (keyed by id) —
  // NOT on every `goal` object identity change (a background sync pull or any
  // write re-emits new object refs and would wipe the user's in-progress edits).
  useEffect(() => {
    if (open) reset(defaultsFor(goal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  const name = useWatch({ control, name: "name" });
  const color = useWatch({ control, name: "color" });
  const icon = useWatch({ control, name: "icon" });

  async function onSubmit(values: SavingsGoalFormValues) {
    try {
      const payload = {
        name: values.name,
        target: values.target,
        note: values.note ?? "",
        color: values.color,
        icon: values.icon,
        targetDate: values.targetDate ?? null,
      };
      if (goal) {
        await savingsGoalRepo.update(goal.id, payload);
        toast.success("Goal updated");
      } else {
        await savingsGoalRepo.create(payload);
        toast.success("Goal created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New savings goal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the target, date, or look of this goal."
              : "Set a target and start tracking your progress."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            <CategoryIcon icon={icon} color={color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {name || "Goal name"}
              </p>
              <p className="text-xs text-muted-foreground">Live preview</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. Emergency fund"
              {...register("name")}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {fieldError(errors.name?.message)}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target amount</Label>
            <Controller
              control={control}
              name="target"
              render={({ field }) => (
                <MoneyInput
                  id="goal-target"
                  size="md"
                  value={field.value ?? null}
                  onChange={(n) => field.onChange(n ?? undefined)}
                  aria-invalid={!!errors.target}
                />
              )}
            />
            {fieldError(errors.target?.message)}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Controller
              control={control}
              name="targetDate"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <DateField
                    id="goal-date"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    className="flex-1"
                  />
                  {field.value ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      aria-label="Clear target date"
                      onClick={() => field.onChange(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              )}
            />
            {fieldError(errors.targetDate?.message)}
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-note">Note (optional)</Label>
            <Input
              id="goal-note"
              placeholder="What is this for?"
              {...register("note")}
              aria-invalid={!!errors.note}
            />
            {fieldError(errors.note?.message)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
