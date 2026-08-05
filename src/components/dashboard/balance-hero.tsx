"use client";

import { motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useMoney } from "@/lib/hooks/use-data";
import { savingsRate, type Totals } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";

export function BalanceHero({ totals, periodLabel }: { totals: Totals; periodLabel: string }) {
  const { fmt } = useMoney();
  const rate = savingsRate(totals);
  const positive = totals.net >= 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="surface-hero surface-grain relative overflow-hidden rounded-3xl p-6 sm:p-8"
    >
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/70">Net balance · {periodLabel}</p>
          <p className="mt-2 font-heading text-4xl font-semibold tracking-tight break-words text-white tabular-nums sm:text-5xl">
            {positive ? "" : "−"}
            {fmt(Math.abs(totals.net))}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <HeroPill
              icon={<ArrowDownLeft className="size-3.5" />}
              label="Income"
              value={fmt(totals.income)}
            />
            <HeroPill
              icon={<ArrowUpRight className="size-3.5" />}
              label="Spent"
              value={fmt(totals.expense)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <SavingsRing value={rate} />
          <div>
            <p className="text-xs text-white/70">Savings rate</p>
            <p className="font-heading text-xl font-semibold text-white tabular-nums">
              {formatPercent(Math.max(0, rate))}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function HeroPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-2.5 pr-3.5 text-sm text-white backdrop-blur-sm">
      <span className="grid size-6 place-items-center rounded-full bg-white/15">{icon}</span>
      <span className="text-white/70">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function SavingsRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const deg = (pct / 100) * 360;
  return (
    <div
      className="grid size-12 place-items-center rounded-full"
      style={{
        background: `conic-gradient(oklch(0.85 0.13 150) ${deg}deg, rgba(255,255,255,0.18) ${deg}deg)`,
      }}
      role="img"
      aria-label={`Savings rate ${Math.round(pct)} percent`}
    >
      <span className="grid size-9 place-items-center rounded-full bg-[oklch(0.27_0.05_165)] text-[0.7rem] font-semibold text-white tabular-nums">
        {Math.round(pct)}
      </span>
    </div>
  );
}
