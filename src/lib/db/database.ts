import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Budget,
  Category,
  DebtEntry,
  Person,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "@/lib/types";

/** Local-only key/value row for sync bookkeeping (never synced upstream). */
export interface MetaRow {
  key: string;
  value: string;
}

/**
 * Local-first store. All data lives in the browser (IndexedDB) behind this
 * single typed Dexie instance; repositories are the only sanctioned access
 * point so the persistence layer can later be swapped without touching the UI.
 */
export class LedgerlyDB extends Dexie {
  transactions!: EntityTable<Transaction, "id">;
  categories!: EntityTable<Category, "id">;
  budgets!: EntityTable<Budget, "id">;
  settings!: EntityTable<AppSettings, "id">;
  people!: EntityTable<Person, "id">;
  debtEntries!: EntityTable<DebtEntry, "id">;
  savingsGoals!: EntityTable<SavingsGoal, "id">;
  savingsContributions!: EntityTable<SavingsContribution, "id">;
  meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("ledgerly");
    this.version(1).stores({
      transactions: "id, date, type, categoryId, [type+date], createdAt",
      categories: "id, type, archived, isDefault",
      budgets: "id, categoryId, scope",
      settings: "id",
    });
    // v2: add People & Debts, `updatedAt` indexes for sync pulls, and a
    // local-only meta table for sync state.
    this.version(2).stores({
      transactions: "id, date, type, categoryId, [type+date], createdAt, updatedAt",
      categories: "id, type, archived, isDefault, updatedAt",
      budgets: "id, categoryId, scope, updatedAt",
      settings: "id, updatedAt",
      people: "id, name, updatedAt",
      debtEntries: "id, personId, kind, date, updatedAt",
      meta: "key",
    });
    // v3: Savings goals + contributions.
    this.version(3).stores({
      savingsGoals: "id, name, updatedAt",
      savingsContributions: "id, goalId, date, updatedAt",
    });
  }
}

let _db: LedgerlyDB | null = null;

/** Lazily instantiate so the class is never constructed during SSR. */
export function getDB(): LedgerlyDB {
  if (typeof window === "undefined") {
    throw new Error("Database is only available in the browser.");
  }
  if (!_db) {
    _db = new LedgerlyDB();
    registerChangeHooks(_db);
  }
  return _db;
}

// --- Local change notifications (drive auto-sync) ---------------------------

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();
/** Collections whose local writes should schedule a sync. */
const SYNCED_TABLES = [
  "transactions",
  "categories",
  "budgets",
  "settings",
  "people",
  "debtEntries",
  "savingsGoals",
  "savingsContributions",
] as const;

let suppressed = false;

/** Suppress change emissions while applying remote sync writes locally. */
export function withoutChangeEvents<T>(fn: () => Promise<T>): Promise<T> {
  suppressed = true;
  return fn().finally(() => {
    suppressed = false;
  });
}

export function subscribeLocalChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitLocalChange() {
  if (suppressed) return;
  for (const l of listeners) l();
}

function registerChangeHooks(db: LedgerlyDB) {
  // Fire synchronously (inside the write) so `withoutChangeEvents` suppression
  // is reliably in effect while applying remote sync writes.
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    table.hook("creating", emitLocalChange);
    table.hook("updating", emitLocalChange);
    table.hook("deleting", emitLocalChange);
  }
}
