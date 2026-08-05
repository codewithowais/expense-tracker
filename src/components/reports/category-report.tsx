"use client";

import { CategoryDonut } from "@/components/charts/category-donut";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { byCategory, type CategorySlice } from "@/lib/analytics";
import { formatPercent, sumMoney } from "@/lib/format";
import type { Category, Transaction, TxType } from "@/lib/types";
import { ReportSection, TableFrame } from "./report-primitives";

interface CategoryReportProps {
  txs: Transaction[];
  categories: Category[];
}

export function CategoryReport({ txs, categories }: CategoryReportProps) {
  const expenseSlices = byCategory(txs, categories, "expense");
  const incomeSlices = byCategory(txs, categories, "income");

  return (
    <div className="space-y-8">
      <CategoryBlock title="Where the money went" type="expense" slices={expenseSlices} />
      <CategoryBlock title="Where the money came from" type="income" slices={incomeSlices} />
    </div>
  );
}

function CategoryBlock({
  title,
  type,
  slices,
}: {
  title: string;
  type: TxType;
  slices: CategorySlice[];
}) {
  const total = sumMoney(slices.map((s) => s.total));
  const label = type === "expense" ? "Expenses" : "Income";

  return (
    <ReportSection title={title} description={`${label} grouped by category, largest first.`}>
      {slices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
          No {type} recorded this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center">
          <div className="break-inside-avoid rounded-2xl border border-border/70 p-5">
            <CategoryDonut slices={slices} total={total} centerLabel={label} />
          </div>
          <TableFrame>
            <Table>
              <TableCaption className="sr-only">
                {label} by category, with transaction counts, totals, and share of {type} activity
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col" className="text-right">
                    Txns
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Total
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Share
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slices.map((s) => (
                  <TableRow key={s.categoryId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.category ? (
                          <CategoryIcon icon={s.category.icon} color={s.category.color} size="sm" />
                        ) : null}
                        <span className="font-medium">{s.category?.name ?? "Uncategorized"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.count}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money amount={s.total} tone={type} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPercent(s.pct, 1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {slices.reduce((n, s) => n + s.count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={total} tone={type} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    100%
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableFrame>
        </div>
      )}
    </ReportSection>
  );
}
