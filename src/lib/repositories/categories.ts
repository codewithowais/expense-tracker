import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { Category, TxType } from "@/lib/types";

export interface CategoryInput {
  name: string;
  type: TxType;
  color: string;
  icon: string;
}

export const categoryRepo = {
  async list(includeArchived = false): Promise<Category[]> {
    const all = (await getDB().categories.toArray()).filter((c) => !c.deletedAt);
    all.sort((a, b) => a.name.localeCompare(b.name));
    return includeArchived ? all : all.filter((c) => !c.archived);
  },

  async get(id: string): Promise<Category | undefined> {
    return getDB().categories.get(id);
  },

  async create(input: CategoryInput): Promise<Category> {
    const now = nowISO();
    const row: Category = {
      id: newId(),
      name: input.name.trim(),
      type: input.type,
      color: input.color,
      icon: input.icon,
      isDefault: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().categories.add(row);
    return row;
  },

  async update(id: string, patch: Partial<CategoryInput & { archived: boolean }>): Promise<void> {
    await getDB().categories.update(id, { ...patch, updatedAt: nowISO() });
  },

  /** How many live transactions reference this category. */
  async usageCount(id: string): Promise<number> {
    return getDB()
      .transactions.where("categoryId")
      .equals(id)
      .and((t) => !t.deletedAt)
      .count();
  },

  /**
   * Delete a category (soft). If it is in use, transactions are reassigned to
   * `reassignToId`; otherwise the delete is blocked to avoid orphans.
   */
  async remove(id: string, reassignToId?: string): Promise<void> {
    const db = getDB();
    const now = nowISO();
    const usage = await this.usageCount(id);
    if (usage > 0) {
      if (!reassignToId) throw new Error("Category is in use; provide a reassignment target.");
      await db.transactions
        .where("categoryId")
        .equals(id)
        .and((t) => !t.deletedAt)
        .modify({ categoryId: reassignToId, updatedAt: now });
    }
    await db.categories.update(id, { deletedAt: now, updatedAt: now });
  },

  async archive(id: string, archived = true): Promise<void> {
    await this.update(id, { archived });
  },
};
