"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { useMoney } from "@/lib/hooks/use-data";
import { formatPercent } from "@/lib/format";
import type { CategorySlice } from "@/lib/analytics";

interface CategoryDonutProps {
  slices: CategorySlice[];
  /** Total shown in the donut center. */
  total: number;
  centerLabel?: string;
  maxLegend?: number;
}

export function CategoryDonut({
  slices,
  total,
  centerLabel = "Total",
  maxLegend = 6,
}: CategoryDonutProps) {
  const { fmt } = useMoney();
  const data = slices.map((s) => ({
    name: s.category?.name ?? "Uncategorized",
    value: s.total,
    color: `var(--${s.category?.color ?? "chart-2"})`,
  }));

  const legend = slices.slice(0, maxLegend);
  const restCount = slices.length - legend.length;

  return (
    // Container query: stack vertically until the *card* (not the viewport) is
    // wide enough for a side-by-side layout — prevents the legend from being
    // clipped inside narrow grid cells.
    <div className="@container">
      <div className="flex flex-col items-center gap-6 @[24rem]:flex-row @[24rem]:items-center @[24rem]:gap-6">
        <div className="relative size-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={78}
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
            <span className="amount font-heading text-lg font-semibold tabular-nums">
              {fmt(total, { compact: true })}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {legend.map((s) => (
          <li key={s.categoryId} className="flex items-center gap-3">
            <CategoryIcon
              icon={s.category?.icon ?? "ReceiptText"}
              color={s.category?.color ?? "chart-2"}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.category?.name ?? "Uncategorized"}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, s.pct)}%`,
                    backgroundColor: `var(--${s.category?.color ?? "chart-2"})`,
                  }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Money amount={s.total} className="whitespace-nowrap text-sm font-semibold" />
              <p className="text-xs text-muted-foreground tabular-nums">{formatPercent(s.pct)}</p>
            </div>
          </li>
        ))}
          {restCount > 0 ? (
            <li className="pt-1 text-center text-xs text-muted-foreground">
              +{restCount} more categor{restCount === 1 ? "y" : "ies"}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
