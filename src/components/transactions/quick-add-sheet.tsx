"use client";

import { toast } from "sonner";
import { TransactionForm } from "./transaction-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { transactionRepo } from "@/lib/repositories/transactions";
import { useQuickAdd } from "@/stores/ui-store";
import type { TransactionFormValues } from "@/lib/schemas";

/** App-wide create/edit transaction sheet, driven by the quick-add store. */
export function QuickAddSheet() {
  const { open, editing, defaultType, close } = useQuickAdd();
  const isEdit = Boolean(editing);

  async function handleSubmit(values: TransactionFormValues) {
    try {
      if (editing) {
        await transactionRepo.update(editing.id, values);
        toast.success("Transaction updated");
      } else {
        await transactionRepo.create(values);
        toast.success(values.type === "income" ? "Income added" : "Expense added");
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
