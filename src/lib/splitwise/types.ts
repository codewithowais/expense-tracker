/**
 * Splitwise import — shared contract.
 *
 * The archive is stored in dedicated, indexed, LOCAL Dexie tables (not synced),
 * so tens of thousands of rows never bloat sync or slow the rest of the app.
 * Reports read a pre-computed `SplitwiseReport` (cached in `splitwiseMeta`) so
 * they're instant regardless of row count.
 */

/** One imported line, from YOUR perspective toward one other person. */
export interface SplitwiseEntry {
  id: string;
  /** Splitwise group name. */
  group: string;
  /** The OTHER person (never you). */
  person: string;
  /** Calendar date, ISO "YYYY-MM-DD". */
  date: string;
  /** "YYYY" — denormalized for indexed year queries. */
  year: string;
  /** "YYYY-MM" — denormalized for indexed month queries. */
  ym: string;
  description: string;
  /** Total cost of the whole expense. */
  cost: number;
  /** Your pairwise delta with `person` for this expense:
   *  positive = they owe you / you gave; negative = you owe them. */
  delta: number;
}

/** Cached aggregate report + import bookkeeping (single row, id = "summary"). */
export interface SplitwiseMeta {
  id: string; // always "summary"
  report: SplitwiseReport;
  importedAt: string;
  /** Group names imported so far. */
  sources: string[];
}

export interface PersonAgg {
  person: string;
  /** Sum of deltas (net position with them; + = they owe you). */
  net: number;
  /** Total you gave / they owed you (sum of positive deltas). */
  gave: number;
  /** Total you owed them (sum of |negative deltas|). */
  owed: number;
  count: number;
}

export interface PeriodAgg {
  /** "YYYY" for years, "YYYY-MM" for months. */
  key: string;
  net: number;
  grossGiven: number;
  grossOwed: number;
  count: number;
}

export interface PlaceAgg {
  description: string;
  /** Total gross activity (sum of |delta|) for this description. */
  total: number;
  count: number;
}

export interface SplitwiseReport {
  totalEntries: number;
  dateRange: { start: string; end: string } | null;
  groups: string[];
  people: string[];
  /** Your overall net across all imported data. */
  net: number;
  byPerson: PersonAgg[]; // sorted by |net| desc
  byYear: PeriodAgg[]; // ascending
  byMonth: PeriodAgg[]; // ascending
  byPlace: PlaceAgg[]; // top by total, desc
}

/** Output of parsing ONE Splitwise printable-summary HTML export. */
export interface SplitwiseParseResult {
  group: string;
  me: string;
  /** Other people in the group (excludes you). */
  people: string[];
  entries: Omit<SplitwiseEntry, "id">[];
}

export const EMPTY_REPORT: SplitwiseReport = {
  totalEntries: 0,
  dateRange: null,
  groups: [],
  people: [],
  net: 0,
  byPerson: [],
  byYear: [],
  byMonth: [],
  byPlace: [],
};
