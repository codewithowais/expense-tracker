import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { DateRange } from "@/lib/dates";
import type { PaymentMethod, Transaction, TxType } from "@/lib/types";

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  date: string;
  method: PaymentMethod;
}

export type TxSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface TransactionFilter {
  range?: DateRange;
  types?: TxType[];
  categoryIds?: string[];
  methods?: PaymentMethod[];
  search?: string;
  min?: number;
  max?: number;
  sort?: TxSort;
}

function applySort(rows: Transaction[], sort: TxSort = "date-desc"): Transaction[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sort) {
      case "date-asc":
        return a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date);
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "date-desc":
      default:
        return a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date);
    }
  });
  return sorted;
}

export const transactionRepo = {
  async all(): Promise<Transaction[]> {
    const rows = await getDB().transactions.toArray();
    return rows.filter((r) => !r.deletedAt);
  },

  async query(filter: TransactionFilter = {}): Promise<Transaction[]> {
    const db = getDB();
    let rows: Transaction[];

    if (filter.range) {
      rows = await db.transactions
        .where("date")
        .between(filter.range.start, filter.range.end, true, true)
        .toArray();
    } else {
      rows = await db.transactions.toArray();
    }

    // Exclude soft-deleted tombstones from all reads.
    rows = rows.filter((r) => !r.deletedAt);

    if (filter.types?.length) {
      const set = new Set(filter.types);
      rows = rows.filter((r) => set.has(r.type));
    }
    if (filter.categoryIds?.length) {
      const set = new Set(filter.categoryIds);
      rows = rows.filter((r) => set.has(r.categoryId));
    }
    if (filter.methods?.length) {
      const set = new Set(filter.methods);
      rows = rows.filter((r) => set.has(r.method));
    }
    if (typeof filter.min === "number") rows = rows.filter((r) => r.amount >= filter.min!);
    if (typeof filter.max === "number") rows = rows.filter((r) => r.amount <= filter.max!);
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      rows = rows.filter((r) => r.note.toLowerCase().includes(q));
    }

    return applySort(rows, filter.sort);
  },

  async get(id: string): Promise<Transaction | undefined> {
    return getDB().transactions.get(id);
  },

  async create(input: TransactionInput): Promise<Transaction> {
    const now = nowISO();
    const row: Transaction = {
      id: newId(),
      ...normalize(input),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().transactions.add(row);
    return row;
  },

  async update(id: string, input: Partial<TransactionInput>): Promise<void> {
    const patch: Partial<Transaction> = { ...input, updatedAt: nowISO() };
    if (input.note !== undefined) patch.note = input.note.trim();
    await getDB().transactions.update(id, patch);
  },

  /** Soft delete (tombstone) so the deletion can sync to other devices. */
  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().transactions.update(id, { deletedAt: now, updatedAt: now });
  },

  async bulkCreate(inputs: TransactionInput[]): Promise<number> {
    const now = nowISO();
    const rows: Transaction[] = inputs.map((i) => ({
      id: newId(),
      ...normalize(i),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));
    await getDB().transactions.bulkAdd(rows);
    return rows.length;
  },

  async count(): Promise<number> {
    return getDB().transactions.filter((r) => !r.deletedAt).count();
  },

  async clearAll(): Promise<void> {
    const now = nowISO();
    await getDB()
      .transactions.filter((r) => !r.deletedAt)
      .modify({ deletedAt: now, updatedAt: now });
  },
};

function normalize(input: TransactionInput) {
  return {
    type: input.type,
    amount: Math.abs(input.amount),
    categoryId: input.categoryId,
    note: input.note.trim(),
    date: input.date,
    method: input.method,
  };
}
