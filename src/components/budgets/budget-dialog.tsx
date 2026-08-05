"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/shared/money-input";
import { CategoryIcon } from "@/components/shared/category-icon";
import { budgetRepo } from "@/lib/repositories/budgets";
import { budgetSchema, type BudgetFormValues } from "@/lib/schemas";
import { useBudgets, useCategories } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";
import type { Budget } from "@/lib/types";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

/** Create/edit dialog for a monthly budget, remounted fresh each time it opens. */
export function BudgetDialog({ open, onOpenChange, budget }: BudgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <BudgetDialogForm
            key={`${budget?.id ?? "new"}-${open}`}
            budget={budget}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface BudgetDialogFormProps {
  budget?: Budget;
  onDone: () => void;
  onCancel: () => void;
}

function BudgetDialogForm({ budget, onDone, onCancel }: BudgetDialogFormProps) {
  const categories = useCategories();
  const budgets = useBudgets();
  const isEdit = Boolean(budget);

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === "expense"),
    [categories],
  );

  // Categories that already have a budget, excluding the one currently being edited.
  const budgetedCategoryIds = useMemo(
    () =>
      new Set(
        (budgets ?? [])
          .filter((b) => b.scope === "category" && b.id !== budget?.id)
          .map((b) => b.categoryId),
      ),
    [budgets, budget?.id],
  );

  const categoryOptions = useMemo(
    () => expenseCategories.filter((c) => !budgetedCategoryIds.has(c.id)),
    [expenseCategories, budgetedCategoryIds],
  );

  const hasOtherOverall = useMemo(
    () => (budgets ?? []).some((b) => b.scope === "overall" && b.id !== budget?.id),
    [budgets, budget?.id],
  );

  const categoryScopeDisabled = categoryOptions.length === 0;

  const defaultScope: "overall" | "category" =
    budget?.scope ?? (hasOtherOverall ? "category" : "overall");

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      scope: defaultScope,
      categoryId: budget?.categoryId ?? null,
      amount: budget?.amount ?? (undefined as unknown as number),
    },
  });

  const scope = useWatch({ control, name: "scope" });

  async function onSubmit(values: BudgetFormValues) {
    if (values.scope === "category" && !values.categoryId) {
      setError("categoryId", { message: "Pick a category" });
      return;
    }
    try {
      await budgetRepo.upsert(
        {
          scope: values.scope,
          categoryId: values.scope === "overall" ? null : values.categoryId,
          amount: values.amount,
        },
        budget?.id,
      );
      toast.success(isEdit ? "Budget updated" : "Budget created");
      onDone();
    } catch {
      toast.error("Couldn’t save the budget. Please try again.");
    }
  }

  const noValidScope =
    (scope === "overall" && hasOtherOverall) || (scope === "category" && categoryScopeDisabled);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit budget" : "New budget"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Adjust this monthly limit."
            : "Set a monthly spending limit, overall or for a single category."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Scope</Label>
          <Controller
            control={control}
            name="scope"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  clearErrors("categoryId");
                }}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-2xl border border-input px-3 py-2.5 text-sm transition-colors",
                    field.value === "overall" ? "border-primary bg-accent" : "cursor-pointer",
                    hasOtherOverall && "cursor-not-allowed opacity-50",
                  )}
                >
                  <RadioGroupItem value="overall" disabled={hasOtherOverall} />
                  <span className="flex flex-col">
                    <span className="font-medium">Overall</span>
                    {hasOtherOverall ? (
                      <span className="text-xs text-muted-foreground">Already set</span>
                    ) : null}
                  </span>
                </label>
                <label
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-2xl border border-input px-3 py-2.5 text-sm transition-colors",
                    field.value === "category" ? "border-primary bg-accent" : "cursor-pointer",
                    categoryScopeDisabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <RadioGroupItem value="category" disabled={categoryScopeDisabled} />
                  <span className="flex flex-col">
                    <span className="font-medium">Category</span>
                    {categoryScopeDisabled ? (
                      <span className="text-xs text-muted-foreground">None available</span>
                    ) : null}
                  </span>
                </label>
              </RadioGroup>
            )}
          />
        </div>

        {scope === "category" ? (
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value ?? undefined}
                  onValueChange={(v) => {
                    field.onChange(v);
                    clearErrors("categoryId");
                  }}
                >
                  <SelectTrigger
                    id="budget-category"
                    className="w-full"
                    aria-invalid={!!errors.categoryId}
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2.5">
                          <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                    {categoryOptions.length === 0 ? (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No categories available
                      </div>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
            />
            {fieldError(errors.categoryId?.message)}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="budget-amount">Monthly limit</Label>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="budget-amount"
                size="md"
                value={field.value ?? null}
                onChange={(n) => field.onChange(n ?? undefined)}
                aria-invalid={!!errors.amount}
                autoFocus
              />
            )}
          />
          {fieldError(errors.amount?.message)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="gap-2" disabled={isSubmitting || noValidScope}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create budget"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
