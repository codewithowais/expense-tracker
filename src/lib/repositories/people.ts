import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { DebtEntry, DebtKind, Person } from "@/lib/types";

export interface PersonInput {
  name: string;
  note?: string;
}

export const peopleRepo = {
  async list(): Promise<Person[]> {
    const rows = (await getDB().people.toArray()).filter((p) => !p.deletedAt);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },

  async get(id: string): Promise<Person | undefined> {
    return getDB().people.get(id);
  },

  async create(input: PersonInput): Promise<Person> {
    const now = nowISO();
    const row: Person = {
      id: newId(),
      name: input.name.trim(),
      note: input.note?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().people.add(row);
    return row;
  },

  async update(id: string, patch: Partial<PersonInput>): Promise<void> {
    const next: Partial<Person> = { updatedAt: nowISO() };
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.note !== undefined) next.note = patch.note.trim();
    await getDB().people.update(id, next);
  },

  /** Soft-delete a person and all of their debt entries. */
  async remove(id: string): Promise<void> {
    const db = getDB();
    const now = nowISO();
    await db.transaction("rw", db.people, db.debtEntries, async () => {
      await db.people.update(id, { deletedAt: now, updatedAt: now });
      await db.debtEntries
        .where("personId")
        .equals(id)
        .and((e) => !e.deletedAt)
        .modify({ deletedAt: now, updatedAt: now });
    });
  },
};

export interface DebtInput {
  personId: string;
  kind: DebtKind;
  amount: number;
  note?: string;
  date: string;
}

export const debtRepo = {
  async all(): Promise<DebtEntry[]> {
    const rows = await getDB().debtEntries.toArray();
    return rows.filter((e) => !e.deletedAt);
  },

  async listByPerson(personId: string): Promise<DebtEntry[]> {
    const rows = await getDB()
      .debtEntries.where("personId")
      .equals(personId)
      .and((e) => !e.deletedAt)
      .toArray();
    rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
    return rows;
  },

  async create(input: DebtInput): Promise<DebtEntry> {
    const now = nowISO();
    const row: DebtEntry = {
      id: newId(),
      personId: input.personId,
      kind: input.kind,
      amount: Math.abs(input.amount),
      note: input.note?.trim() ?? "",
      date: input.date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().debtEntries.add(row);
    return row;
  },

  async update(id: string, patch: Partial<DebtInput>): Promise<void> {
    const next: Partial<DebtEntry> = { updatedAt: nowISO() };
    if (patch.kind !== undefined) next.kind = patch.kind;
    if (patch.amount !== undefined) next.amount = Math.abs(patch.amount);
    if (patch.note !== undefined) next.note = patch.note.trim();
    if (patch.date !== undefined) next.date = patch.date;
    await getDB().debtEntries.update(id, next);
  },

  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().debtEntries.update(id, { deletedAt: now, updatedAt: now });
  },
};
