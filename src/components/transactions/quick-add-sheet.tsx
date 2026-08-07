"use client";

import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { transactionRepo } from "@/lib/repositories/transactions";
import { useMoney, useCategories } from "@/lib/hooks/use-data";
import { useQuickAdd } from "@/stores/ui-store";
import type { TransactionFormValues } from "@/lib/schemas";

/** App-wide create/edit transaction sheet, driven by the quick-add store. */
export function QuickAddSheet() {
  const { open, editing, defaultType, close } = useQuickAdd();
  const { fmt } = useMoney();
  const categories = useCategories(true);
  const isEdit = Boolean(editing);

  /** A richer confirmation snackbar: side-tinted icon + amount · category. */
  function notifySaved(values: TransactionFormValues, updated: boolean) {
    const income = values.type === "income";
    const category = categories?.find((c) => c.id === values.categoryId)?.name;
    const detail = [fmt(values.amount), category].filter(Boolean).join("  ·  ");
    toast.success(updated ? "Transaction updated" : income ? "Income added" : "Expense added", {
      description: detail,
      icon: income ? (
        <ArrowDownLeft className="size-4 text-income" />
      ) : (
        <ArrowUpRight className="size-4 text-expense" />
      ),
    });
  }

  async function handleSubmit(values: TransactionFormValues) {
    try {
      if (editing) {
        await transactionRepo.update(editing.id, values);
        notifySaved(values, true);
      } else {
        await transactionRepo.create(values);
        notifySaved(values, false);
      }
      close();
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-heading text-xl">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update the details below."
              : "Record income or an expense to keep your ledger current."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-6">
          {/* Remount on target change so defaults reset cleanly. */}
          <TransactionForm
            key={editing?.id ?? `new-${defaultType}`}
            initial={
              editing
                ? {
                    type: editing.type,
                    amount: editing.amount,
                    categoryId: editing.categoryId,
                    note: editing.note,
                    date: editing.date,
                    method: editing.method,
                  }
                : { type: defaultType }
            }
            submitLabel={isEdit ? "Save changes" : "Add transaction"}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
