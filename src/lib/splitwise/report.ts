/**
 * Splitwise report aggregation.
 *
 * `buildReport` folds imported Splitwise entries into a pre-computed
 * `SplitwiseReport` (net position, per-person / per-year / per-month / per-place
 * breakdowns). It is a pure function of its input and performs a single grouping
 * pass with `Map`s so it stays linear over 30k–50k rows.
 *
 * `delta` sign convention (from YOUR perspective toward `person`):
 * positive = they owe you / you gave; negative = you owe them.
 */

import {
  type SplitwiseEntry,
  type SplitwiseReport,
  type PersonAgg,
  type PeriodAgg,
  type PlaceAgg,
  EMPTY_REPORT,
} from "@/lib/splitwise/types";

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface PersonAcc {
  person: string;
  net: number;
  gave: number;
  owed: number;
  count: number;
}

interface PeriodAcc {
  key: string;
  net: number;
  grossGiven: number;
  grossOwed: number;
  count: number;
}

interface PlaceAcc {
  description: string;
  total: number;
  count: number;
}

/**
 * Aggregate imported Splitwise entries into a cache-ready report.
 * Returns `EMPTY_REPORT` when given no entries.
 */
export function buildReport(
  entries: Array<Omit<SplitwiseEntry, "id"> | SplitwiseEntry>,
): SplitwiseReport {
  if (entries.length === 0) return EMPTY_REPORT;

  let net = 0;
  let start = entries[0].date;
  let end = entries[0].date;

  const groups = new Set<string>();
  const people = new Set<string>();
  const personMap = new Map<string, PersonAcc>();
  const yearMap = new Map<string, PeriodAcc>();
  const monthMap = new Map<string, PeriodAcc>();
  const placeMap = new Map<string, PlaceAcc>();

  for (const e of entries) {
    const { group, person, date, year, ym, description, delta } = e;

    net += delta;

    if (date < start) start = date;
    if (date > end) end = date;

    groups.add(group);
    people.add(person);

    const pos = delta > 0 ? delta : 0;
    const neg = delta < 0 ? -delta : 0;

    // byPerson
    let pa = personMap.get(person);
    if (pa === undefined) {
      pa = { person, net: 0, gave: 0, owed: 0, count: 0 };
      personMap.set(person, pa);
    }
    pa.net += delta;
    pa.gave += pos;
    pa.owed += neg;
    pa.count += 1;

    // byYear
    let ya = yearMap.get(year);
    if (ya === undefined) {
      ya = { key: year, net: 0, grossGiven: 0, grossOwed: 0, count: 0 };
      yearMap.set(year, ya);
    }
    ya.net += delta;
    ya.grossGiven += pos;
    ya.grossOwed += neg;
    ya.count += 1;

    // byMonth
    let ma = monthMap.get(ym);
    if (ma === undefined) {
      ma = { key: ym, net: 0, grossGiven: 0, grossOwed: 0, count: 0 };
      monthMap.set(ym, ma);
    }
    ma.net += delta;
    ma.grossGiven += pos;
    ma.grossOwed += neg;
    ma.count += 1;

    // byPlace (skip empty descriptions)
    if (description) {
      let la = placeMap.get(description);
      if (la === undefined) {
        la = { description, total: 0, count: 0 };
        placeMap.set(description, la);
      }
      la.total += Math.abs(delta);
      la.count += 1;
    }
  }

  const byPerson: PersonAgg[] = Array.from(personMap.values())
    .map((p) => ({
      person: p.person,
      net: round2(p.net),
      gave: round2(p.gave),
      owed: round2(p.owed),
      count: p.count,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const toPeriod = (p: PeriodAcc): PeriodAgg => ({
    key: p.key,
    net: round2(p.net),
    grossGiven: round2(p.grossGiven),
    grossOwed: round2(p.grossOwed),
    count: p.count,
  });

  const byYear: PeriodAgg[] = Array.from(yearMap.values())
    .map(toPeriod)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const byMonth: PeriodAgg[] = Array.from(monthMap.values())
    .map(toPeriod)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const byPlace: PlaceAgg[] = Array.from(placeMap.values())
    .map((p) => ({
      description: p.description,
      total: round2(p.total),
      count: p.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  return {
    totalEntries: entries.length,
    dateRange: { start, end },
    groups: Array.from(groups).sort(),
    people: Array.from(people),
    net: round2(net),
    byPerson,
    byYear,
    byMonth,
    byPlace,
  };
}
