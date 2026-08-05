"use client";

import { PiggyBank, Target, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { summarizeGoals } from "@/lib/savings";
import { formatPercent, relativeDay } from "@/lib/format";
import type { SavingsContribution, SavingsGoal } from "@/lib/types";
import { ReportSection, MeterBar } from "./report-primitives";

interface SavingsReportProps {
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
}

export function SavingsReport({ goals, contributions }: SavingsReportProps) {
  const { progress, totalSaved, totalTarget, overallPct } = summarizeGoals(goals, contributions);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 break-inside-avoid sm:grid-cols-3 print:grid-cols-3 print:gap-3">
        <StatCard
          label="Total saved"
          icon={PiggyBank}
          accent="savings"
          value={<Money amount={totalSaved} tone="income" />}
        />
        <StatCard
          label="Total target"
          icon={Target}
          accent="chart-4"
          value={<Money amount={totalTarget} />}
        />
        <StatCard
          label="Overall progress"
          icon={TrendingUp}
          accent="income"
          value={<span className="tabular-nums">{formatPercent(overallPct, 1)}</span>}
        />
      </div>

      <ReportSection
        title="Goal progress"
        description="How close each goal is to its target."
      >
        {progress.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
            No savings goals yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {progress.map((p) => (
              <li
                key={p.goal.id}
                className="break-inside-avoid rounded-2xl border border-border/70 p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <CategoryIcon icon={p.goal.icon} color={p.goal.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-medium text-foreground">{p.goal.name}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        <Money amount={p.saved} className="font-semibold text-foreground" /> of{" "}
                        <Money amount={p.target} />
                      </p>
                    </div>
                    <div className="mt-2.5">
                      <MeterBar pct={p.pct} color={p.goal.color} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {p.complete ? (
                          <span className="font-medium text-income">Goal reached</span>
                        ) : (
                          <>
                            {formatPercent(p.pct, 0)} · <Money amount={p.remaining} /> to go
                          </>
                        )}
                      </span>
                      <span>
                        {p.contributionCount} contribution{p.contributionCount === 1 ? "" : "s"}
                        {p.lastActivity ? ` · ${relativeDay(p.lastActivity)}` : ""}
                      </span>
                    </div>
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
