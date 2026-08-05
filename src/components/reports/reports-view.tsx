"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  LayoutDashboard,
  LineChart,
  PieChart,
  PiggyBank,
  Printer,
  ReceiptText,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPanel, StatCardsSkeleton } from "@/components/shared/states";
import { PresetSelect } from "@/components/shared/period-controls";
import { Button } from "@/components/ui/button";
import { presetRange, rangeLabel, type PresetKey } from "@/lib/dates";
import { exportTransactionsCSV } from "@/lib/backup";
import { downloadFile } from "@/lib/csv";
import { type ReportId } from "@/lib/reports";
import {
  useCategories,
  useDebtEntries,
  usePeople,
  useSavingsContributions,
  useSavingsGoals,
  useSettings,
  useTransactionCount,
  useTransactions,
} from "@/lib/hooks/use-data";
import { ReportPicker, type ReportOption } from "./report-picker";
import { ReportShell } from "./report-shell";
import { SummaryReport } from "./summary-report";
import { CategoryReport } from "./category-report";
import { TrendReport } from "./trend-report";
import { PeopleReport } from "./people-report";
import { SavingsReport } from "./savings-report";
import { TransactionsReport } from "./transactions-report";

const REPORTS: ReportOption[] = [
  {
    id: "summary",
    label: "Period summary",
    description: "Income, expenses, net & savings rate",
    icon: LayoutDashboard,
  },
  {
    id: "categories",
    label: "Category breakdown",
    description: "Spending & income by category",
    icon: PieChart,
  },
  {
    id: "trend",
    label: "Income vs. expense",
    description: "Cash-flow trend over the period",
    icon: LineChart,
  },
  {
    id: "people",
    label: "People & debts",
    description: "Balances and who owes whom",
    icon: Users,
  },
  {
    id: "savings",
    label: "Savings goals",
    description: "Progress toward each goal",
    icon: PiggyBank,
  },
  {
    id: "transactions",
    label: "Top transactions",
    description: "Largest items & merchants",
    icon: ReceiptText,
  },
];

export function ReportsView() {
  const [reportId, setReportId] = useState<ReportId>("summary");
  const [presetKey, setPresetKey] = useState<PresetKey>("this-month");
  const [exporting, setExporting] = useState(false);

  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  const range = useMemo(
    () => presetRange(presetKey, new Date(), monthStartDay),
    [presetKey, monthStartDay],
  );

  const txs = useTransactions({ range });
  const categories = useCategories();
  const people = usePeople();
  const debtEntries = useDebtEntries();
  const goals = useSavingsGoals();
  const contributions = useSavingsContributions();
  const totalCount = useTransactionCount();

  const ready =
    txs !== undefined &&
    categories !== undefined &&
    settings !== undefined &&
    people !== undefined &&
    debtEntries !== undefined &&
    goals !== undefined &&
    contributions !== undefined;

  // Any ledger the reports can draw on — not just transactions, so a user who
  // only tracks debts or savings still gets a report instead of the empty state.
  const hasAnyData =
    (totalCount ?? 0) > 0 ||
    (people?.length ?? 0) > 0 ||
    (debtEntries?.length ?? 0) > 0 ||
    (goals?.length ?? 0) > 0;

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

  const activeReport = REPORTS.find((r) => r.id === reportId) ?? REPORTS[0];

  function renderReport() {
    if (!ready) return null;
    switch (reportId) {
      case "summary":
        return <SummaryReport txs={txs} range={range} />;
      case "categories":
        return <CategoryReport txs={txs} categories={categories} />;
      case "trend":
        return <TrendReport txs={txs} range={range} />;
      case "people":
        return <PeopleReport people={people} debtEntries={debtEntries} />;
      case "savings":
        return <SavingsReport goals={goals} contributions={contributions} />;
      case "transactions":
        return <TransactionsReport txs={txs} categories={categories} />;
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Pick a report and a period, then print or save it as a PDF."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PresetSelect value={presetKey} onChange={setPresetKey} />
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportCSV}
                disabled={exporting || !ready}
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
      </div>

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <LoadingPanel rows={4} />
        </div>
      ) : !hasAnyData ? (
        <EmptyState
          icon={FileText}
          title="Nothing to report yet"
          description="Add a few transactions, debts, or savings goals to generate a shareable report."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] print:block">
          <ReportPicker
            options={REPORTS}
            value={reportId}
            onChange={setReportId}
            className="self-start lg:sticky lg:top-6 print:hidden"
          />
          <ReportShell
            reportLabel={activeReport.label}
            periodLabel={rangeLabel(range)}
            preparedFor={settings?.name || undefined}
          >
            {renderReport()}
          </ReportShell>
        </div>
      )}

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
