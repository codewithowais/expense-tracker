"use client";

import { CashflowChart, type CashflowPoint } from "@/components/charts/cashflow-chart";
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
import { dailySeries, monthlySeries, yearlySeries, totals, type MonthlyPoint } from "@/lib/analytics";
import { rangeDays, preferYearlyBuckets, type DateRange } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { ReportSection, TableFrame } from "./report-primitives";

interface TrendReportProps {
  txs: Transaction[];
  range: DateRange;
}

/** Short (<= ~13 weeks) periods read best day-by-day; longer ones by month. */
const DAILY_THRESHOLD = 92;

export function TrendReport({ txs, range }: TrendReportProps) {
  const days = rangeDays(range);
  // Multi-year ranges read best bucketed by year; short ones day-by-day; the rest monthly.
  const useYearly = preferYearlyBuckets(range);
  const useDaily = !useYearly && days <= DAILY_THRESHOLD;
  const buckets = useYearly ? yearlySeries(txs, range) : monthlySeries(txs, range);
  const t = totals(txs);

  const chartData: CashflowPoint[] = useDaily
    ? dailySeries(txs, range).map((d) => ({
        label: formatDate(d.date, "short"),
        income: d.income,
        expense: d.expense,
      }))
    : buckets.map((m) => ({ label: m.label, income: m.income, expense: m.expense }));

  const grain = useDaily ? "day" : useYearly ? "year" : "month";
  const bucketNoun = useYearly ? "year" : "month";

  return (
    <div className="space-y-8">
      <ReportSection
        title="Income vs. expense"
        description={`Cash-flow by ${grain} across the selected period.`}
      >
        <div className="break-inside-avoid rounded-2xl border border-border/70 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-income" aria-hidden /> Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-expense" aria-hidden /> Expense
            </span>
          </div>
          {chartData.length === 0 ? (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">
              No activity in this period.
            </div>
          ) : (
            <CashflowChart data={chartData} variant={useDaily ? "area" : "bar"} height={280} />
          )}
        </div>
      </ReportSection>

      <ReportSection title={useYearly ? "Yearly totals" : "Monthly totals"}>
        <TableFrame>
          <Table>
            <TableCaption className="sr-only">
              Income, expenses, and net total for each {bucketNoun} in the selected period
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{useYearly ? "Year" : "Month"}</TableHead>
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
              {buckets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No {bucketNoun}ly data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                buckets.map((m: MonthlyPoint) => (
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
            {buckets.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right">
                    <Money amount={t.income} tone="income" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={t.expense} tone="expense" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={t.net} tone="net" />
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
