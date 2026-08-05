"use client";

import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { topTransactions } from "@/lib/analytics";
import { topMerchants } from "@/lib/reports";
import { formatDate, formatPercent } from "@/lib/format";
import type { Category, Transaction, TxType } from "@/lib/types";
import { ReportSection, TableFrame, MeterBar } from "./report-primitives";

interface TransactionsReportProps {
  txs: Transaction[];
  categories: Category[];
}

export function TransactionsReport({ txs, categories }: TransactionsReportProps) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const topExpenses = topTransactions(txs, "expense", 10);
  const topIncome = topTransactions(txs, "income", 5);
  const merchants = topMerchants(txs, "expense", 8);

  return (
    <div className="space-y-8">
      <ReportSection title="Largest expenses" description="The ten biggest expenses this period.">
        <LargestTable txs={topExpenses} type="expense" catById={catById} />
      </ReportSection>

      <ReportSection title="Largest income" description="The five biggest income entries this period.">
        <LargestTable txs={topIncome} type="income" catById={catById} />
      </ReportSection>

      <ReportSection
        title="Top merchants"
        description="Expenses grouped by note, ranked by total spend."
      >
        {merchants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
            No expenses recorded this period.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {merchants.map((m) => (
              <li key={m.key} className="flex items-center gap-3 break-inside-avoid">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <Money amount={m.total} className="shrink-0 text-sm font-semibold" tone="expense" />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <MeterBar pct={m.pct} color="expense" className="flex-1" />
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {m.count} txn{m.count === 1 ? "" : "s"} · {formatPercent(m.pct, 0)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>
    </div>
  );
}

function LargestTable({
  txs,
  type,
  catById,
}: {
  txs: Transaction[];
  type: TxType;
  catById: Map<string, Category>;
}) {
  if (txs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
        No {type} recorded this period.
      </div>
    );
  }
  return (
    <TableFrame>
      <Table>
        <TableCaption className="sr-only">
          The largest {type} transactions in the selected period
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Date</TableHead>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col">Note</TableHead>
            <TableHead scope="col" className="text-right">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {txs.map((tx) => {
            const category = catById.get(tx.categoryId);
            return (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(tx.date, "medium")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {category ? (
                      <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                    ) : null}
                    <span className="font-medium">{category?.name ?? "Uncategorized"}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                  {tx.note || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Money amount={tx.amount} tone={type} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
