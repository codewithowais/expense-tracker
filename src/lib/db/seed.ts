import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { newId, nowISO } from "@/lib/crypto";
import { roundMoney, toISODate } from "@/lib/format";
import type { AppSettings, Category, Transaction } from "@/lib/types";
import { getDB } from "./database";

let seedPromise: Promise<void> | null = null;

/**
 * Create default settings + categories on first run. Idempotent and safe to
 * call concurrently — the work runs exactly once per session. MUST be invoked
 * outside any Dexie live-query context (it performs writes); call it from an
 * effect at app startup, never from a repository read used by `useLiveQuery`.
 */
export function ensureSeed(): Promise<void> {
  if (!seedPromise) seedPromise = runSeed();
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const db = getDB();
  const settings = await db.settings.get("app");
  if (!settings) {
    const now = nowISO();
    const fresh: AppSettings = {
      id: "app",
      name: "",
      currency: "PKR",
      monthStartDay: 1,
      hasCompletedSetup: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.settings.add(fresh);
  }

  const count = await db.categories.count();
  if (count === 0) {
    const now = nowISO();
    const rows: Category[] = DEFAULT_CATEGORIES.map((c) => ({
      // Deterministic id so every device seeds the SAME default categories —
      // sync then dedupes them (same id) instead of creating duplicates.
      id: defaultCategoryId(c.name, c.type),
      name: c.name,
      type: c.type,
      color: c.color,
      icon: c.icon,
      isDefault: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));
    await db.categories.bulkAdd(rows);
  }
}

function defaultCategoryId(name: string, type: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `default-${type}-${slug}`;
}

// Deterministic-ish pseudo random so demo data feels realistic but varied.
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Populate ~4 months of believable transactions. Skips silently if the ledger
 * already has entries so we never double-seed.
 */
export async function generateDemoData(): Promise<number> {
  const db = getDB();
  const existing = await db.transactions.count();
  if (existing > 0) return 0;

  const cats = await db.categories.toArray();
  const byName = (n: string) => cats.find((c) => c.name === n);
  const rand = rng(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const rows: Transaction[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const expensePlan: { name: string; min: number; max: number; perMonth: number; notes: string[] }[] =
    [
      { name: "Groceries", min: 1500, max: 6000, perMonth: 8, notes: ["Weekly groceries", "Supermarket", "Vegetables & fruit", "Household items"] },
      { name: "Dining", min: 600, max: 3500, perMonth: 6, notes: ["Lunch out", "Dinner with friends", "Coffee", "Takeaway"] },
      { name: "Transport", min: 300, max: 2500, perMonth: 6, notes: ["Fuel", "Ride share", "Bus pass", "Parking"] },
      { name: "Utilities", min: 2000, max: 8000, perMonth: 2, notes: ["Electricity bill", "Gas bill", "Water"] },
      { name: "Entertainment", min: 500, max: 4000, perMonth: 3, notes: ["Movie tickets", "Streaming", "Concert", "Games"] },
      { name: "Shopping", min: 1000, max: 12000, perMonth: 2, notes: ["Clothes", "Electronics", "Gifts"] },
      { name: "Health", min: 500, max: 6000, perMonth: 1, notes: ["Pharmacy", "Doctor visit", "Gym"] },
    ];

  const now2 = nowISO();
  for (let m = 0; m <= 3; m++) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const isCurrentMonth =
      monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
    const maxDay = isCurrentMonth ? now.getDate() : daysInMonth;

    // Salary income
    const salary = byName("Salary");
    if (salary) {
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(1, maxDay));
      rows.push(makeTx("income", roundMoney(120000 + rand() * 20000), salary.id, "Monthly salary", toISODate(d), "bank", now2));
    }
    const freelance = byName("Freelance");
    if (freelance && rand() > 0.5) {
      const day = Math.min(Math.floor(rand() * maxDay) + 1, maxDay);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      rows.push(makeTx("income", roundMoney(8000 + rand() * 25000), freelance.id, "Side project", toISODate(d), "wallet", now2));
    }

    for (const plan of expensePlan) {
      const cat = byName(plan.name);
      if (!cat) continue;
      const n = Math.max(1, Math.round(plan.perMonth * (0.6 + rand() * 0.8)));
      for (let i = 0; i < n; i++) {
        const day = Math.min(Math.floor(rand() * maxDay) + 1, maxDay);
        const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const amount = roundMoney(plan.min + rand() * (plan.max - plan.min));
        rows.push(makeTx("expense", amount, cat.id, pick(plan.notes), toISODate(d), pick(["cash", "card", "bank", "wallet"] as const), now2));
      }
    }
  }

  await db.transactions.bulkAdd(rows);
  return rows.length;
}

function makeTx(
  type: Transaction["type"],
  amount: number,
  categoryId: string,
  note: string,
  date: string,
  method: Transaction["method"],
  ts: string,
): Transaction {
  return {
    id: newId(),
    type,
    amount,
    categoryId,
    note,
    date,
    method,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
