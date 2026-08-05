"use client";

import { ArrowDownLeft, ArrowUpRight, Percent, Scale } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
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
import { monthlySeries, type MonthlyPoint } from "@/lib/analytics";
import { periodStats } from "@/lib/reports";
import { formatPercent } from "@/lib/format";
import type { DateRange } from "@/lib/dates";
import type { Transaction } from "@/lib/types";
import { ReportSection, TableFrame, FactTile } from "./report-primitives";

interface SummaryReportProps {
  txs: Transaction[];
  range: DateRange;
}

export function SummaryReport({ txs, range }: SummaryReportProps) {
  const s = periodStats(txs, range);
  const months = monthlySeries(txs, range);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 break-inside-avoid sm:grid-cols-2 print:grid-cols-4 print:gap-3 xl:grid-cols-4">
        <StatCard
          label="Total income"
          icon={ArrowDownLeft}
          accent="income"
          value={<Money amount={s.income} tone="income" />}
        />
        <StatCard
          label="Total expenses"
          icon={ArrowUpRight}
          accent="expense"
          value={<Money amount={s.expense} tone="expense" />}
        />
        <StatCard
          label="Net"
          icon={Scale}
          accent="chart-4"
          value={<Money amount={s.net} tone="net" />}
        />
        <StatCard
          label="Savings rate"
          icon={Percent}
          accent="savings"
          value={<span className="tabular-nums">{formatPercent(s.rate, 1)}</span>}
        />
      </div>

      <ReportSection
        title="At a glance"
        description="How this period's activity breaks down."
      >
        <div className="grid grid-cols-2 gap-3 break-inside-avoid lg:grid-cols-4">
          <FactTile
            label="Transactions"
            value={<span className="tabular-nums">{s.count}</span>}
            hint={`${s.incomeCount} in · ${s.expenseCount} out`}
          />
          <FactTile label="Avg. expense" value={<Money amount={s.avgExpenseSize} />} hint="per transaction" />
          <FactTile label="Avg. income" value={<Money amount={s.avgIncomeSize} />} hint="per transaction" />
          <FactTile
            label="Daily spend"
            value={<Money amount={s.avgExpensePerDay} />}
            hint={`over ${s.days} day${s.days === 1 ? "" : "s"}`}
          />
        </div>
      </ReportSection>

      <ReportSection title="Monthly breakdown">
        <TableFrame>
          <Table>
            <TableCaption className="sr-only">
              Income, expenses, and net total for each month in the selected period
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Month</TableHead>
                <TableHead scope="col" className="text-right">
                  Income
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Expenses
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Net
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No monthly data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                months.map((m: MonthlyPoint) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right">
                      <Money amount={m.income} tone="income" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money amount={m.expense} tone="expense" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money amount={m.net} tone="net" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {months.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right">
                    <Money amount={s.income} tone="income" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={s.expense} tone="expense" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={s.net} tone="net" />
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </TableFrame>
      </ReportSection>
    </div>
  );
}
