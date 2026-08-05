import { CURRENCIES } from "./constants";
import type { CurrencyCode } from "./types";

/**
 * Sum money values without floating-point drift by accumulating in the
 * currency's minor units (integer arithmetic) before converting back.
 */
export function sumMoney(values: number[], decimals = 2): number {
  const factor = 10 ** decimals;
  const totalMinor = values.reduce((acc, v) => acc + Math.round(v * factor), 0);
  return totalMinor / factor;
}

export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatCurrency(
  amount: number,
  code: CurrencyCode,
  options: { compact?: boolean; signed?: boolean } = {},
): string {
  const c = CURRENCIES[code];
  const { compact = false, signed = false } = options;
  const abs = Math.abs(amount);

  const nf = new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code === "PKR" ? "PKR" : c.code,
    minimumFractionDigits: compact ? 0 : c.decimals,
    maximumFractionDigits: c.decimals,
    notation: compact && abs >= 10000 ? "compact" : "standard",
  });

  // Normalize odd/absent glyphs to our configured symbol for consistency.
  let out = nf.format(abs);
  if (code === "PKR") out = out.replace(/PKR|₨/g, c.symbol).trim();

  if (signed) {
    const sign = amount < 0 ? "−" : "+";
    return `${sign}${out}`;
  }
  return amount < 0 ? `−${out}` : out;
}

/** Symbol-only compact figure for dense chart axes/labels. */
export function formatCompact(amount: number, code: CurrencyCode): string {
  const c = CURRENCIES[code];
  const nf = new Intl.NumberFormat(c.locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return `${c.symbol}${nf.format(amount)}`;
}

/**
 * Parse free-form money input ("1,250.50", "Rs 1250", "1.2k") into a number.
 * Returns null when the string has no parseable numeric value.
 */
export function parseMoneyInput(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/[^0-9.,kmb-]/g, "");
  let multiplier = 1;
  if (s.endsWith("k")) {
    multiplier = 1_000;
    s = s.slice(0, -1);
  } else if (s.endsWith("m")) {
    multiplier = 1_000_000;
    s = s.slice(0, -1);
  } else if (s.endsWith("b")) {
    multiplier = 1_000_000_000;
    s = s.slice(0, -1);
  }
  // Treat commas as thousands separators.
  s = s.replace(/,/g, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return roundMoney(n * multiplier);
}

const DAY = 86_400_000;

export function formatDate(iso: string, style: "short" | "medium" | "long" = "medium"): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "short" }
      : style === "long"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

/** Human relative label for a transaction date ("Today", "Yesterday", or date). */
export function relativeDay(iso: string, today = todayISO()): string {
  const a = new Date(`${iso}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  const diff = Math.round((b - a) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatDate(iso, "medium");
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

/** Compact "time ago" label ("just now", "2m ago", "3h ago", or a date). */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(toISODate(new Date(iso)), "medium");
}

/** Local clock time, e.g. "2:45 PM". */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}
