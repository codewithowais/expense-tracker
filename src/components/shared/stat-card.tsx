import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Palette token for the icon tile, e.g. "chart-1" or a semantic name. */
  accent?: string;
  /** Signed percentage vs. the previous period; null hides the delta. */
  delta?: number | null;
  /** For spend metrics, an increase is "bad" (red); flip the coloring. */
  invertDelta?: boolean;
  hint?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "chart-1",
  delta,
  invertDelta = false,
  hint,
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const rising = hasDelta && delta! > 0.05;
  const falling = hasDelta && delta! < -0.05;
  const good = invertDelta ? falling : rising;
  const bad = invertDelta ? rising : falling;

  return (
    <Card className={cn("card-elevated gap-0 p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklab, var(--${accent}) 15%, transparent)`,
            color: `var(--${accent})`,
          }}
        >
          <Icon className="size-[1.05rem]" aria-hidden />
        </span>
      </div>
      <div className="mt-3 font-heading text-2xl font-semibold leading-tight tracking-tight break-words tabular-nums sm:text-[1.7rem]">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
              good && "bg-income-soft text-income",
              bad && "bg-expense-soft text-expense",
              !good && !bad && "bg-muted text-muted-foreground",
            )}
          >
            {rising ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : falling ? (
              <ArrowDownRight className="size-3.5" aria-hidden />
            ) : null}
            {formatPercent(Math.abs(delta!), 1)}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}
