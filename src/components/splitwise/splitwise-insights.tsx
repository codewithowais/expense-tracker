"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  Hash,
  Loader2,
  MapPin,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SplitwiseReport } from "@/lib/splitwise/types";

interface SplitwiseInsightsProps {
  report: SplitwiseReport;
  importing: boolean;
  onImportFile: (file: File) => void;
  onClear: () => void;
}

/** How many people to show before the "show all" toggle. */
const PERSON_CAP = 20;

export function SplitwiseInsights({
  report,
  importing,
  onImportFile,
  onClear,
}: SplitwiseInsightsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAllPeople, setShowAllPeople] = useState(false);

  const hasData = report.totalEntries > 0;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportFile(file);
    // Reset so choosing the same file again still fires a change event.
    event.target.value = "";
  };

  const visiblePeople = showAllPeople
    ? report.byPerson
    : report.byPerson.slice(0, PERSON_CAP);

  // Largest |net| across years, for the horizontal bar scale.
  const maxYearNet = useMemo(
    () => report.byYear.reduce((max, y) => Math.max(max, Math.abs(y.net)), 0),
    [report.byYear],
  );

  // The busiest month by gross activity, to flag with a "highest" chip.
  const peakMonthKey = useMemo(() => {
    let key: string | null = null;
    let max = -Infinity;
    for (const m of report.byMonth) {
      const gross = m.grossGiven + m.grossOwed;
      if (gross > max) {
        max = gross;
        key = m.key;
      }
    }
    return key;
  }, [report.byMonth]);

  return (
    <div className="space-y-6">
      {/* Import row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,text/html"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          {importing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {importing ? "Importing…" : "Import Splitwise HTML"}
        </Button>

        {hasData ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={importing}>
                <Trash2 className="size-4" aria-hidden />
                Clear imported data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear imported data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all imported Splitwise history and the report built
                  from it. This can&apos;t be undone, but you can re-import your HTML
                  export anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onClear}>
                  Clear data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {!hasData ? (
        <EmptyState
          icon={Users}
          title="No Splitwise data yet"
          description="Export a Splitwise group's printable summary as HTML, then import it here to analyze years of shared history — broken down by person, year, month and place."
          action={
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              Import Splitwise HTML
            </Button>
          }
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Entries"
              icon={Hash}
              accent="chart-1"
              value={report.totalEntries.toLocaleString()}
            />
            <StatCard
              label="Date range"
              icon={CalendarRange}
              accent="chart-4"
              value={
                report.dateRange ? (
                  <span className="text-base font-medium sm:text-lg">
                    {formatDate(report.dateRange.start, "short")} –{" "}
                    {formatDate(report.dateRange.end, "short")}
                  </span>
                ) : (
                  "—"
                )
              }
              hint={
                report.dateRange
                  ? formatDate(report.dateRange.end).slice(-4)
                  : undefined
              }
            />
            <StatCard
              label="Your net"
              icon={Wallet}
              accent={report.net >= 0 ? "income" : "expense"}
              value={<Money amount={report.net} tone="net" signed />}
              hint={report.net >= 0 ? "You're owed overall" : "You owe overall"}
            />
            <StatCard
              label="People"
              icon={Users}
              accent="chart-2"
              value={report.people.length.toLocaleString()}
              hint={
                report.groups.length
                  ? `${report.groups.length} group${report.groups.length === 1 ? "" : "s"}`
                  : undefined
              }
            />
          </div>

          {/* By person */}
          <SectionCard
            title="By person"
            description="How much you gave and received with each person."
            action={
              report.byPerson.length > PERSON_CAP ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAllPeople((v) => !v)}
                >
                  {showAllPeople
                    ? "Show less"
                    : `Show all ${report.byPerson.length}`}
                </Button>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {visiblePeople.map((p) => (
                <li
                  key={p.person}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {p.person}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      gave <Money amount={p.gave} className="text-xs" /> · owed{" "}
                      <Money amount={p.owed} className="text-xs" /> ·{" "}
                      {p.count.toLocaleString()}{" "}
                      {p.count === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <Money
                    amount={p.net}
                    tone="net"
                    signed
                    className="shrink-0 font-medium"
                  />
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* By year */}
          <SectionCard
            title="By year"
            description="Your net position over time."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {report.byYear.map((y) => {
                const pct =
                  maxYearNet > 0
                    ? Math.max(4, (Math.abs(y.net) / maxYearNet) * 100)
                    : 0;
                return (
                  <li key={y.key} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium tabular-nums text-foreground">
                        {y.key}
                      </span>
                      <div className="flex items-center gap-3">
                        <Money
                          amount={y.net}
                          tone="net"
                          signed
                          className="font-medium"
                        />
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {y.count.toLocaleString()}{" "}
                          {y.count === 1 ? "entry" : "entries"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {/* By month */}
          <SectionCard
            title="By month"
            description="Monthly net across the whole history."
            bodyClassName="p-0"
          >
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {report.byMonth.map((m) => (
                <li
                  key={m.key}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-medium tabular-nums text-foreground">
                      {m.key}
                    </span>
                    {m.key === peakMonthKey ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-accent-foreground">
                        highest
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Money
                      amount={m.net}
                      tone="net"
                      signed
                      className="font-medium"
                    />
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {m.count.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Top places */}
          <SectionCard
            title="Top places"
            description="Where the most shared activity happened."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {report.byPlace.map((p, i) => (
                <li
                  key={`${p.description}-${i}`}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        "bg-accent text-accent-foreground",
                      )}
                    >
                      <MapPin className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {p.description}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.count.toLocaleString()}{" "}
                        {p.count === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  </div>
                  <Money amount={p.total} className="shrink-0 font-medium" />
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
