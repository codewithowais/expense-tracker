"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMoney } from "@/lib/hooks/use-data";
import { formatCompact } from "@/lib/format";

export interface CashflowPoint {
  label: string;
  income: number;
  expense: number;
}

interface CashflowChartProps {
  data: CashflowPoint[];
  variant?: "area" | "bar";
  height?: number;
  /** Which series to plot. */
  series?: ("income" | "expense")[];
}

export function CashflowChart({
  data,
  variant = "area",
  height = 260,
  series = ["income", "expense"],
}: CashflowChartProps) {
  const { fmt, code } = useMoney();

  const axis = {
    tick: { fontSize: 11, fill: "var(--muted-foreground)" },
    tickLine: false,
    axisLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--accent)", opacity: 0.4 }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
          <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lg">
            <p className="mb-1 font-medium text-foreground">{label}</p>
            <div className="space-y-0.5">
              {payload.map((p) => (
                <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground capitalize">
                    <span className="size-2 rounded-full" style={{ background: p.color }} />
                    {String(p.dataKey)}
                  </span>
                  <span className="amount font-medium tabular-nums">{fmt(Number(p.value))}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    />
  );

  if (variant === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v) => formatCompact(Number(v), code)} width={52} />
          {tooltip}
          {series.includes("income") ? (
            <Bar dataKey="income" fill="var(--income)" radius={[6, 6, 0, 0]} maxBarSize={38} />
          ) : null}
          {series.includes("expense") ? (
            <Bar dataKey="expense" fill="var(--expense)" radius={[6, 6, 0, 0]} maxBarSize={38} />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--income)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--expense)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} tickFormatter={(v) => formatCompact(Number(v), code)} width={52} />
        {tooltip}
        {series.includes("expense") ? (
          <Area
            type="monotone"
            dataKey="expense"
            stroke="var(--expense)"
            strokeWidth={2}
            fill="url(#fillExpense)"
          />
        ) : null}
        {series.includes("income") ? (
          <Area
            type="monotone"
            dataKey="income"
            stroke="var(--income)"
            strokeWidth={2}
            fill="url(#fillIncome)"
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
