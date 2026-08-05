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
  // Round the magnitude then reapply the sign, so negatives round symmetrically
  // (native Math.round(-0.5) === -0, breaking symmetry with +0.5 → 1).
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
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
 * Parse free-form money input ("1,250.50", "Rs 1250", "1.2k") into a number,
 * rounded to `decimals` places. Returns null when there is no valid amount.
 * Rejects garbage strictly: "1e5", "5abc", "1.2.3" → null (never a wrong number).
 */
export function parseMoneyInput(raw: string, decimals = 2): number | null {
  if (!raw) return null;
  // Drop a leading non-numeric prefix (currency symbols/letters/spaces) only.
  let s = raw.trim().toLowerCase().replace(/^[^\d.-]+/, "");
  // Thousands separators.
  s = s.replace(/,/g, "");
  // A number with at most one trailing magnitude suffix, and nothing else.
  const match = s.match(/^(-?\d*\.?\d+)(k|m|b)?$/);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  if (!Number.isFinite(n)) return null;
  const mult =
    match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : match[2] === "b" ? 1_000_000_000 : 1;
  return roundMoney(n * mult, decimals);
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
  // Parse bare "YYYY-MM-DD" as local midnight (native Date treats it as UTC).
  const t = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(toISODate(new Date(iso)), "medium");
}

/** Local clock time in 12-hour format, e.g. "2:45 PM". */
export function formatClock(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Local date + 12-hour time, e.g. "5 Aug 2026, 2:45 PM". */
export function formatDateTime(iso: string): string {
  // Parse a bare "YYYY-MM-DD" as local midnight (native Date treats it as UTC).
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
