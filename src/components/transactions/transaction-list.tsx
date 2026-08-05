"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { formatDate, formatDateTime, relativeDay } from "@/lib/format";
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
              {rows.map((t, i) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  cat={catById.get(t.categoryId)}
                  bordered={i > 0}
                  onEdit={() => openEdit(t)}
                  onDeleteRequest={() => setPendingDelete(t)}
                />
              ))}
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

interface TransactionRowProps {
  t: Transaction;
  cat: Category | undefined;
  bordered: boolean;
  onEdit: () => void;
  onDeleteRequest: () => void;
}

/** A single transaction row that expands into an animated detail accordion. */
function TransactionRow({ t, cat, bordered, onEdit, onDeleteRequest }: TransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const reactId = useId();
  const panelId = `tx-panel-${reactId}`;

  function toggle() {
    setExpanded((v) => !v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  const editedSeparately = t.updatedAt !== t.createdAt;

  return (
    <li className={cn(bordered && "border-t border-border")}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className="flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/40 sm:px-4"
      >
        <CategoryIcon icon={cat?.icon ?? "ReceiptText"} color={cat?.color ?? "chart-2"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{t.note || cat?.name || "Transaction"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {cat?.name ?? "Uncategorized"} · {methodLabel(t.method)}
          </p>
        </div>
        <Money amount={t.amount} tone={t.type} signed className="text-sm font-semibold sm:text-base" />
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDeleteRequest}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border bg-muted/30 px-3 py-4 sm:grid-cols-2 sm:px-4">
              <DetailField label="Description">
                {t.note ? (
                  <span className="text-sm text-foreground">{t.note}</span>
                ) : (
                  <span className="text-sm italic text-muted-foreground">No description</span>
                )}
              </DetailField>

              <DetailField label="Category">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CategoryIcon
                    icon={cat?.icon ?? "ReceiptText"}
                    color={cat?.color ?? "chart-2"}
                    size="sm"
                  />
                  {cat?.name ?? "Uncategorized"}
                </span>
              </DetailField>

              <DetailField label="Payment method">
                <span className="text-sm text-foreground">{methodLabel(t.method)}</span>
              </DetailField>

              <DetailField label="Date">
                <span className="text-sm tabular-nums text-foreground">{formatDate(t.date, "long")}</span>
              </DetailField>

              <DetailField label="Amount">
                <Money amount={t.amount} tone={t.type} signed className="text-sm font-semibold" />
              </DetailField>

              <DetailField label="Type">
                <span className="text-sm capitalize text-foreground">{t.type}</span>
              </DetailField>

              <DetailField label="Added">
                <span className="text-sm tabular-nums text-foreground">{formatDateTime(t.createdAt)}</span>
              </DetailField>

              {editedSeparately ? (
                <DetailField label="Last edited">
                  <span className="text-sm tabular-nums text-foreground">
                    {formatDateTime(t.updatedAt)}
                  </span>
                </DetailField>
              ) : null}
            </dl>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
