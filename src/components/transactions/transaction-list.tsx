"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
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
import { relativeDay } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { transactionRepo } from "@/lib/repositories/transactions";
import { useQuickAdd } from "@/stores/ui-store";
import type { Category, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  /** Show the small date group headers. */
  grouped?: boolean;
}

const methodLabel = (v: string) => PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v;

export function TransactionList({ transactions, categories, grouped = true }: TransactionListProps) {
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const openEdit = useQuickAdd((s) => s.openEdit);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const groups = useMemo(() => {
    if (!grouped) return [["", transactions]] as [string, Transaction[]][];
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions, grouped]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const removed = pendingDelete;
    await transactionRepo.remove(removed.id);
    setPendingDelete(null);
    toast.success("Transaction deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          transactionRepo.create({
            type: removed.type,
            amount: removed.amount,
            categoryId: removed.categoryId,
            note: removed.note,
            date: removed.date,
            method: removed.method,
          }),
      },
    });
  }

  return (
    <>
      <div className="space-y-6">
        {groups.map(([date, rows]) => (
          <div key={date || "all"}>
            {grouped && date ? (
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {relativeDay(date)}
                </span>
              </div>
            ) : null}
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {rows.map((t, i) => {
                const cat = catById.get(t.categoryId);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/40 sm:px-4",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <CategoryIcon
                      icon={cat?.icon ?? "ReceiptText"}
                      color={cat?.color ?? "chart-2"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {t.note || cat?.name || "Transaction"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cat?.name ?? "Uncategorized"} · {methodLabel(t.method)}
                      </p>
                    </div>
                    <Money
                      amount={t.amount}
                      tone={t.type}
                      signed
                      className="text-sm font-semibold sm:text-base"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 rounded-lg text-muted-foreground"
                          aria-label="Transaction actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)}>
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingDelete(t)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the entry from your ledger. You can undo right after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
