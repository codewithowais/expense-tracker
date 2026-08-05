import { sumMoney } from "./format";
import type { DebtEntry, Person } from "./types";

/** Signed contribution of an entry to "net owed to you" (positive = they owe you). */
export function entryDelta(e: DebtEntry): number {
  switch (e.kind) {
    case "lent":
      return e.amount;
    case "received":
      return -e.amount;
    case "borrowed":
      return -e.amount;
    case "repaid":
      return e.amount;
  }
}

/** Net balance for a set of entries. Positive = they owe you; negative = you owe them. */
export function balanceOf(entries: DebtEntry[]): number {
  return sumMoney(entries.map(entryDelta));
}

export interface PersonSummary {
  person: Person;
  /** Positive = they owe you; negative = you owe them. */
  balance: number;
  entryCount: number;
  lastActivity: string | null;
}

export interface DebtsOverview {
  summaries: PersonSummary[];
  owedToYou: number;
  youOwe: number;
  net: number;
}

export function summarizePeople(people: Person[], entries: DebtEntry[]): DebtsOverview {
  const byPerson = new Map<string, DebtEntry[]>();
  for (const e of entries) {
    const arr = byPerson.get(e.personId) ?? [];
    arr.push(e);
    byPerson.set(e.personId, arr);
  }

  const summaries: PersonSummary[] = people.map((person) => {
    const list = byPerson.get(person.id) ?? [];
    const lastActivity = list.reduce<string | null>(
      (max, e) => (max === null || e.date > max ? e.date : max),
      null,
    );
    return {
      person,
      balance: balanceOf(list),
      entryCount: list.length,
      lastActivity,
    };
  });

  // Outstanding balances first (largest magnitude), settled people last.
  summaries.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  const owedToYou = sumMoney(summaries.filter((s) => s.balance > 0).map((s) => s.balance));
  const youOwe = sumMoney(summaries.filter((s) => s.balance < 0).map((s) => -s.balance));

  return { summaries, owedToYou, youOwe, net: sumMoney([owedToYou, -youOwe]) };
}

export function debtKindLabel(kind: DebtEntry["kind"]): string {
  switch (kind) {
    case "lent":
      return "You lent";
    case "received":
      return "They repaid you";
    case "borrowed":
      return "You borrowed";
    case "repaid":
      return "You repaid";
  }
}
