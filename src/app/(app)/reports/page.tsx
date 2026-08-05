"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileText,
  Percent,
  Printer,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPanel, StatCardsSkeleton } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { CategoryIcon } from "@/components/shared/category-icon";
import { PresetSelect } from "@/components/shared/period-controls";
import { Button } from "@/components/ui/button";
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
import {
  byCategory,
  monthlySeries,
  savingsRate,
  topTransactions,
  totals as computeTotals,
  type CategorySlice,
  type MonthlyPoint,
} from "@/lib/analytics";
import { presetRange, rangeLabel, type PresetKey } from "@/lib/dates";
import { formatDate, formatPercent, todayISO } from "@/lib/format";
import { APP_NAME } from "@/lib/constants";
import { exportTransactionsCSV } from "@/lib/backup";
import { downloadFile } from "@/lib/csv";
import {
  useCategories,
  useSettings,
  useTransactionCount,
  useTransactions,
} from "@/lib/hooks/use-data";
import type { Transaction, TxType } from "@/lib/types";

export default function ReportsPage() {
  const [presetKey, setPresetKey] = useState<PresetKey>("this-month");
  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  const range = useMemo(
    () => presetRange(presetKey, new Date(), monthStartDay),
    [presetKey, monthStartDay],
  );

  const txs = useTransactions({ range });
  const categories = useCategories();
  const totalCount = useTransactionCount();
  const [exporting, setExporting] = useState(false);

  const ready = txs !== undefined && categories !== undefined && settings !== undefined;

  const view = useMemo(() => {
    if (!txs || !categories) return null;
    const t = computeTotals(txs);
    const rate = savingsRate(t);
    const expenseSlices = byCategory(txs, categories, "expense");
    const incomeSlices = byCategory(txs, categories, "income");
    const months = monthlySeries(txs, range);
    const topExpenses = topTransactions(txs, "expense", 5);
    return { t, rate, expenseSlices, incomeSlices, months, topExpenses };
  }, [txs, categories, range]);

  async function handleExportCSV() {
    try {
      setExporting(true);
      const csv = await exportTransactionsCSV(range);
      downloadFile(`ledgerly-transactions-${range.start}_${range.end}.csv`, csv, "text/csv");
      toast.success("Transactions exported to CSV");
    } catch {
      toast.error("Couldn’t export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="A shareable summary of your finances for any period."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PresetSelect value={presetKey} onChange={setPresetKey} />
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCSV}
              disabled={exporting}
            >
              <Download className="size-4" />
              Download CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print / Save as PDF
            </Button>
          </div>
        }
      />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <LoadingPanel rows={4} />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing to report yet"
          description="Add a few transactions to generate a shareable financial summary."
        />
      ) : view ? (
        <div
          id="report"
          className="space-y-8 rounded-3xl border border-border/70 bg-card p-6 shadow-sm print:space-y-6 print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-8"
        >
          {/* Report header */}
          <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {APP_NAME}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Financial summary for{" "}
                <span className="font-medium text-foreground">{rangeLabel(range)}</span>
              </p>
              {settings?.name ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Prepared for {settings.name}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              Generated {formatDate(todayISO(), "long")}
            </p>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-1 gap-4 break-inside-avoid sm:grid-cols-2 print:grid-cols-4 print:gap-3 xl:grid-cols-4">
            <StatCard
              label="Total income"
              icon={ArrowDownLeft}
              accent="income"
              value={<Money amount={view.t.income} tone="income" />}
            />
            <StatCard
              label="Total expenses"
              icon={ArrowUpRight}
              accent="expense"
              value={<Money amount={view.t.expense} tone="expense" />}
            />
            <StatCard
              label="Net"
              icon={Scale}
              accent="chart-4"
              value={<Money amount={view.t.net} tone="net" />}
            />
            <StatCard
              label="Savings rate"
              icon={Percent}
              accent="savings"
              value={<span className="tabular-nums">{formatPercent(view.rate, 1)}</span>}
            />
          </div>

          {/* Category breakdown */}
          <section className="space-y-5">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Category breakdown
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CategoryBreakdownTable
                title="Expenses"
                type="expense"
                slices={view.expenseSlices}
              />
              <CategoryBreakdownTable title="Income" type="income" slices={view.incomeSlices} />
            </div>
          </section>

          {/* Monthly breakdown */}
          <section className="space-y-4 break-inside-avoid">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Monthly breakdown
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border/70">
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
                  {view.months.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        No monthly data for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    view.months.map((m: MonthlyPoint) => (
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
                {view.months.length > 0 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right">
                        <Money amount={view.t.income} tone="income" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={view.t.expense} tone="expense" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money amount={view.t.net} tone="net" />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </section>

          {/* Largest transactions */}
          <section className="space-y-4 break-inside-avoid">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Largest transactions
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <Table>
                <TableCaption className="sr-only">
                  The five largest expense transactions in the selected period
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
                  {view.topExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        No expenses recorded this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    view.topExpenses.map((tx: Transaction) => {
                      const category = categories?.find((c) => c.id === tx.categoryId);
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
                              <span className="font-medium">
                                {category?.name ?? "Uncategorized"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                            {tx.note || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={tx.amount} tone="expense" />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      ) : null}

      <style>{`
        @media print {
          body {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}

function CategoryBreakdownTable({
  title,
  type,
  slices,
}: {
  title: string;
  type: TxType;
  slices: CategorySlice[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 break-inside-avoid">
      <div className="border-b border-border/70 bg-muted/30 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <Table>
        <TableCaption className="sr-only">
          {title} by category, with transaction counts, totals, and share of {type} activity
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col">Type</TableHead>
            <TableHead scope="col" className="text-right">
              Txns
            </TableHead>
            <TableHead scope="col" className="text-right">
              Total
            </TableHead>
            <TableHead scope="col" className="text-right">
              % of type
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                No {type} categories this period.
              </TableCell>
            </TableRow>
          ) : (
            slices.map((s) => (
              <TableRow key={s.categoryId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {s.category ? (
                      <CategoryIcon icon={s.category.icon} color={s.category.color} size="sm" />
                    ) : null}
                    <span className="font-medium">{s.category?.name ?? "Uncategorized"}</span>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{type}</TableCell>
                <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                <TableCell className="text-right">
                  <Money amount={s.total} tone={type} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatPercent(s.pct, 1)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
