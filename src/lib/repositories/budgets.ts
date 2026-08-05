import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { Budget, BudgetScope } from "@/lib/types";

export interface BudgetInput {
  scope: BudgetScope;
  categoryId: string | null;
  amount: number;
}

export const budgetRepo = {
  async list(): Promise<Budget[]> {
    const rows = await getDB().budgets.toArray();
    return rows.filter((b) => !b.deletedAt);
  },

  async get(id: string): Promise<Budget | undefined> {
    return getDB().budgets.get(id);
  },

  /** Create or update the single overall budget or a per-category budget. */
  async upsert(input: BudgetInput): Promise<Budget> {
    const db = getDB();
    const now = nowISO();
    const candidates =
      input.scope === "overall"
        ? await db.budgets.where("scope").equals("overall").toArray()
        : await db.budgets.where("categoryId").equals(input.categoryId ?? "").toArray();
    // Prefer a live row, but a tombstoned one can be revived instead of duplicated.
    const existing = candidates.find((b) => !b.deletedAt) ?? candidates[0];

    if (existing) {
      const patch = { amount: input.amount, updatedAt: now, deletedAt: null };
      await db.budgets.update(existing.id, patch);
      return { ...existing, ...patch };
    }
    const row: Budget = {
      id: newId(),
      scope: input.scope,
      categoryId: input.scope === "overall" ? null : input.categoryId,
      amount: input.amount,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.budgets.add(row);
    return row;
  },

  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().budgets.update(id, { deletedAt: now, updatedAt: now });
  },
};
