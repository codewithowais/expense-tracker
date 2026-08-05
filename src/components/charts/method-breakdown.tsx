"use client";

import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { formatPercent } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { MethodSlice } from "@/lib/analytics";

interface MethodBreakdownProps {
  data: MethodSlice[];
}

const CHART_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"] as const;

/** Horizontal proportion list of spending by payment method. */
export function MethodBreakdown({ data }: MethodBreakdownProps) {
  return (
    <ul className="space-y-4" role="list">
      {data.map((slice, i) => {
        const meta = PAYMENT_METHODS.find((m) => m.value === slice.method);
        const token = CHART_TOKENS[i % CHART_TOKENS.length];
        const label = meta?.label ?? slice.method;
        return (
          <li key={slice.method} className="flex items-center gap-3">
            <CategoryIcon icon={meta?.icon ?? "Wallet"} color={token} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {slice.count} {slice.count === 1 ? "txn" : "txns"}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${label} share`}
                aria-valuenow={Math.round(slice.pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(2, slice.pct)}%`,
                    backgroundColor: `var(--${token})`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <Money amount={slice.total} className="text-sm font-semibold" />
              <p className="text-xs text-muted-foreground tabular-nums">{formatPercent(slice.pct)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
