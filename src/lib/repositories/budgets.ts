import { getDB } from "@/lib/db/database";
import { nowISO } from "@/lib/crypto";
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

  /**
   * Create or update the single overall budget or a per-category budget.
   * Ids are DETERMINISTIC (not random) so two devices that each create the
   * "same" budget offline converge to one row on sync instead of both
   * surviving as duplicates.
   */
  /**
   * @param previousId when editing, the id of the budget being edited — so that
   * changing its scope/category retires the OLD row instead of orphaning it.
   */
  async upsert(input: BudgetInput, previousId?: string): Promise<Budget> {
    const db = getDB();
    const now = nowISO();
    const id = budgetId(input.scope, input.categoryId);

    // Reconcile: tombstone any OTHER live budget for the same scope/category
    // that has a different id (e.g. a legacy random-id row, or a duplicate
    // created offline on another device), PLUS the specific row being edited if
    // its scope/category changed. Without this, an edit would write the
    // deterministic-id row and leave the old one behind as a stale duplicate.
    const siblings =
      input.scope === "overall"
        ? await db.budgets.where("scope").equals("overall").toArray()
        : await db.budgets.where("categoryId").equals(input.categoryId ?? "").toArray();
    const toRetire = new Set(siblings.filter((s) => !s.deletedAt).map((s) => s.id));
    if (previousId) toRetire.add(previousId);
    toRetire.delete(id);
    for (const staleId of toRetire) {
      await db.budgets.update(staleId, { deletedAt: now, updatedAt: now });
    }

    const existing = await db.budgets.get(id);
    const row: Budget = {
      id,
      scope: input.scope,
      categoryId: input.scope === "overall" ? null : input.categoryId,
      amount: input.amount,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.budgets.put(row);
    return row;
  },

  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().budgets.update(id, { deletedAt: now, updatedAt: now });
  },
};

function budgetId(scope: BudgetScope, categoryId: string | null): string {
  return scope === "overall" ? "budget-overall" : `budget-cat-${categoryId ?? ""}`;
}
