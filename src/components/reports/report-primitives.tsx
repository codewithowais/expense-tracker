import { cn } from "@/lib/utils";

/** A titled block inside a report document. Avoids breaking across print pages. */
export function ReportSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 break-inside-avoid", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Bordered frame for a data table. Scrolls horizontally on narrow screens so
 * the page body never does (a11y: horizontal-scroll rule).
 */
export function TableFrame({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/70 break-inside-avoid", className)}>
      {title ? (
        <div className="border-b border-border/70 bg-muted/30 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/** A thin, color-tinted progress meter used in category / savings / merchant rows. */
export function MeterBar({
  pct,
  color = "chart-2",
  className,
}: {
  pct: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, pct))}%`,
          backgroundColor: `var(--${color})`,
        }}
      />
    </div>
  );
}

/** A compact label/value pair for "at a glance" secondary metrics. */
export function FactTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
