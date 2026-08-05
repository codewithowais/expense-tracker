import { getDB } from "@/lib/db/database";
import { ensureSeed } from "@/lib/db/seed";
import { categoryRepo } from "@/lib/repositories/categories";
import { transactionRepo } from "@/lib/repositories/transactions";
import { nowISO } from "@/lib/crypto";
import { parseMoneyInput } from "@/lib/format";
import { toCSV, parseCSV } from "@/lib/csv";
import { CATEGORY_COLORS, PAYMENT_METHODS } from "@/lib/constants";
import type { Budget, Category, PaymentMethod, Transaction, TxType } from "@/lib/types";

const BACKUP_VERSION = 1;

export interface Backup {
  app: "ledgerly";
  version: number;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  settings: { name: string; currency: string; monthStartDay: number };
}

/** Full JSON backup (PIN credentials are intentionally excluded). */
export async function exportBackupJSON(): Promise<string> {
  await ensureSeed();
  const db = getDB();
  const [categories, transactions, budgets, settings] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.settings.get("app"),
  ]);
  const backup: Backup = {
    app: "ledgerly",
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    categories,
    transactions,
    budgets,
    settings: {
      name: settings?.name ?? "",
      currency: settings?.currency ?? "PKR",
      monthStartDay: settings?.monthStartDay ?? 1,
    },
  };
  return JSON.stringify(backup, null, 2);
}

export interface ImportResult {
  categories: number;
  transactions: number;
  budgets: number;
}

/** Replace all data with the contents of a JSON backup. */
export async function importBackupJSON(text: string): Promise<ImportResult> {
  const data = JSON.parse(text) as Partial<Backup>;
  if (data.app !== "ledgerly" || !Array.isArray(data.transactions)) {
    throw new Error("This file isn’t a valid Ledgerly backup.");
  }
  const db = getDB();
  await db.transaction("rw", db.categories, db.transactions, db.budgets, db.settings, async () => {
    await Promise.all([db.categories.clear(), db.transactions.clear(), db.budgets.clear()]);
    if (data.categories?.length) await db.categories.bulkAdd(data.categories);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets);
    if (data.settings) {
      await db.settings.update("app", {
        name: data.settings.name ?? "",
        currency: (data.settings.currency ?? "PKR") as never,
        monthStartDay: data.settings.monthStartDay ?? 1,
        updatedAt: nowISO(),
      });
    }
  });
  return {
    categories: data.categories?.length ?? 0,
    transactions: data.transactions.length,
    budgets: data.budgets?.length ?? 0,
  };
}

const CSV_COLUMNS = ["date", "type", "category", "amount", "method", "note"];

export async function exportTransactionsCSV(range?: { start: string; end: string }): Promise<string> {
  const [allTxs, cats] = await Promise.all([transactionRepo.all(), categoryRepo.list(true)]);
  const txs = range
    ? allTxs.filter((t) => t.date >= range.start && t.date <= range.end)
    : allTxs;
  const catById = new Map(cats.map((c) => [c.id, c]));
  const rows = txs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      type: t.type,
      category: catById.get(t.categoryId)?.name ?? "Uncategorized",
      amount: t.amount,
      method: t.method,
      note: t.note,
    }));
  return toCSV(rows, CSV_COLUMNS);
}

export interface CSVImportResult {
  imported: number;
  skipped: number;
  createdCategories: number;
}

const VALID_METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/** Import transactions from CSV, creating categories by name as needed. */
export async function importTransactionsCSV(text: string): Promise<CSVImportResult> {
  const rows = parseCSV(text);
  if (rows.length === 0) throw new Error("The CSV file has no rows.");

  const cats = await categoryRepo.list(true);
  const catKey = (name: string, type: TxType) => `${type}:${name.toLowerCase()}`;
  const catMap = new Map(cats.map((c) => [catKey(c.name, c.type), c]));
  let createdCategories = 0;
  let colorIdx = 0;

  const toCreate: {
    type: TxType;
    amount: number;
    categoryId: string;
    note: string;
    date: string;
    method: PaymentMethod;
  }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const type: TxType = row.type?.toLowerCase() === "income" ? "income" : "expense";
    const amount = parseMoneyInput(row.amount ?? "");
    const date = (row.date ?? "").trim();
    if (!amount || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped++;
      continue;
    }
    const name = (row.category ?? "Other").trim() || "Other";
    let cat = catMap.get(catKey(name, type));
    if (!cat) {
      cat = await categoryRepo.create({
        name,
        type,
        color: CATEGORY_COLORS[colorIdx++ % CATEGORY_COLORS.length],
        icon: type === "income" ? "HandCoins" : "ReceiptText",
      });
      catMap.set(catKey(name, type), cat);
      createdCategories++;
    }
    const method = (row.method ?? "other").toLowerCase() as PaymentMethod;
    toCreate.push({
      type,
      amount,
      categoryId: cat.id,
      note: row.note ?? "",
      date,
      method: VALID_METHODS.has(method) ? method : "other",
    });
  }

  if (toCreate.length) await transactionRepo.bulkCreate(toCreate);
  return { imported: toCreate.length, skipped, createdCategories };
}

/**
 * Soft-delete ALL financial records (transactions, budgets, people, debts,
 * savings goals + contributions). Uses tombstones — not a hard clear — so the
 * deletions propagate to the cloud on the next sync and stay deleted across
 * devices. Categories and settings are preserved.
 */
export async function clearAllData(): Promise<void> {
  const db = getDB();
  const now = nowISO();
  const tomb = { deletedAt: now, updatedAt: now };
  await db.transaction(
    "rw",
    [db.transactions, db.budgets, db.people, db.debtEntries, db.savingsGoals, db.savingsContributions],
    async () => {
      await db.transactions.filter((r) => !r.deletedAt).modify(tomb);
      await db.budgets.filter((r) => !r.deletedAt).modify(tomb);
      await db.people.filter((r) => !r.deletedAt).modify(tomb);
      await db.debtEntries.filter((r) => !r.deletedAt).modify(tomb);
      await db.savingsGoals.filter((r) => !r.deletedAt).modify(tomb);
      await db.savingsContributions.filter((r) => !r.deletedAt).modify(tomb);
    },
  );
}
