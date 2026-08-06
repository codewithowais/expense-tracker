import {
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { toISODate } from "./format";

export interface DateRange {
  /** Inclusive ISO date "YYYY-MM-DD". */
  start: string;
  /** Inclusive ISO date "YYYY-MM-DD". */
  end: string;
}

export type PresetKey =
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "this-year"
  | "last-year"
  | "all-time";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3-months", label: "Last 3 months" },
  { key: "last-6-months", label: "Last 6 months" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
  { key: "all-time", label: "All time" },
];

/**
 * The active budgeting month for `ref`, honoring a custom salary-cycle start
 * day (e.g. monthStartDay=25 → 25 Jan–24 Feb).
 */
export function monthRange(ref: Date, monthStartDay = 1): DateRange {
  // Clamp to 1..28 so a bad/imported value can never roll the JS Date into the
  // wrong month (e.g. `new Date(y, 1, 31)` overflows into March).
  const startDay = Math.min(28, Math.max(1, Math.floor(monthStartDay) || 1));
  if (startDay <= 1) {
    return { start: toISODate(startOfMonth(ref)), end: toISODate(endOfMonth(ref)) };
  }
  const day = ref.getDate();
  const anchor = day >= startDay ? ref : subMonths(ref, 1);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), startDay);
  const end = subDays(addMonths(start, 1), 1);
  return { start: toISODate(start), end: toISODate(end) };
}

export function shiftMonthRange(range: DateRange, delta: number, monthStartDay = 1): DateRange {
  const ref = addMonths(parseISO(range.start), delta);
  return monthRange(ref, monthStartDay);
}

export function presetRange(key: PresetKey, ref = new Date(), monthStartDay = 1): DateRange {
  switch (key) {
    case "this-month":
      return monthRange(ref, monthStartDay);
    case "last-month":
      return monthRange(subMonths(ref, 1), monthStartDay);
    case "last-3-months":
      return { start: toISODate(startOfMonth(subMonths(ref, 2))), end: toISODate(endOfMonth(ref)) };
    case "last-6-months":
      return { start: toISODate(startOfMonth(subMonths(ref, 5))), end: toISODate(endOfMonth(ref)) };
    case "this-year":
      return { start: toISODate(startOfYear(ref)), end: toISODate(endOfYear(ref)) };
    case "last-year": {
      const prev = subYears(ref, 1);
      return { start: toISODate(startOfYear(prev)), end: toISODate(endOfYear(prev)) };
    }
    case "all-time":
      return { start: "1970-01-01", end: toISODate(endOfDay(ref)) };
  }
}

export function rangeLabel(range: DateRange): string {
  const s = parseISO(range.start);
  const e = parseISO(range.end);
  if (range.start === "1970-01-01") return "All time";
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (sameMonth) return format(s, "MMMM yyyy");
  if (sameYear) return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
  return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

/** Number of days in the range, inclusive. */
export function rangeDays(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
}

export function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso <= range.end;
}

/** ISO days spanning the range — for daily-series charts. */
export function daysInRange(range: DateRange): string[] {
  return eachDayOfInterval({ start: parseISO(range.start), end: parseISO(range.end) }).map(
    toISODate,
  );
}

/** First-of-month ISO dates spanning the range — for monthly-series charts. */
export function monthsInRange(range: DateRange): string[] {
  return eachMonthOfInterval({ start: parseISO(range.start), end: parseISO(range.end) }).map(
    toISODate,
  );
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function monthKeyLabel(key: string): string {
  return format(parseISO(`${key}-01`), "MMM yyyy");
}

/** Whole calendar months spanned by the range, inclusive. */
export function rangeMonths(range: DateRange): number {
  return differenceInCalendarMonths(parseISO(range.end), parseISO(range.start)) + 1;
}

/**
 * True when a range is long enough that a month-by-month view becomes noisy
 * and yearly buckets read better (e.g. multi-year history). Threshold: > 24
 * months.
 */
export function preferYearlyBuckets(range: DateRange): boolean {
  return rangeMonths(range) > 24;
}

/** "YYYY" year strings spanning the range — for yearly-series charts. */
export function yearsInRange(range: DateRange): string[] {
  return eachYearOfInterval({ start: parseISO(range.start), end: parseISO(range.end) }).map((d) =>
    String(d.getFullYear()),
  );
}

export function yearKey(iso: string): string {
  return iso.slice(0, 4); // "YYYY"
}
