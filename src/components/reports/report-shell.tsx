import { formatDate, todayISO } from "@/lib/format";
import { APP_NAME } from "@/lib/constants";

interface ReportShellProps {
  /** Human title of the active report, e.g. "Category breakdown". */
  reportLabel: string;
  /** Formatted period label, e.g. "August 2026". */
  periodLabel: string;
  /** Optional name the report is prepared for (from settings). */
  preparedFor?: string;
  children: React.ReactNode;
}

/**
 * The printable document wrapper: a branded letterhead plus the report body.
 * Print styles drop the card chrome so the page reads like a clean statement
 * when saved to PDF.
 */
export function ReportShell({ reportLabel, periodLabel, preparedFor, children }: ReportShellProps) {
  return (
    <div
      id="report"
      className="space-y-8 rounded-3xl border border-border/70 bg-card p-6 shadow-sm print:space-y-6 print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-8"
    >
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </p>
          <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-foreground">
            {reportLabel}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
          {preparedFor ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Prepared for {preparedFor}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
          Generated {formatDate(todayISO(), "long")}
        </p>
      </header>

      {children}
    </div>
  );
}
