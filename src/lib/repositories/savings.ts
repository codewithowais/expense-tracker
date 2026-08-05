import { getDB } from "@/lib/db/database";
import { newId, nowISO } from "@/lib/crypto";
import type { SavingsContribution, SavingsGoal } from "@/lib/types";

export interface SavingsGoalInput {
  name: string;
  target: number;
  note?: string;
  color: string;
  icon: string;
  targetDate?: string | null;
}

export const savingsGoalRepo = {
  async list(): Promise<SavingsGoal[]> {
    const rows = (await getDB().savingsGoals.toArray()).filter((g) => !g.deletedAt);
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rows;
  },

  async get(id: string): Promise<SavingsGoal | undefined> {
    return getDB().savingsGoals.get(id);
  },

  async create(input: SavingsGoalInput): Promise<SavingsGoal> {
    const now = nowISO();
    const row: SavingsGoal = {
      id: newId(),
      name: input.name.trim(),
      target: Math.abs(input.target),
      note: input.note?.trim() ?? "",
      color: input.color,
      icon: input.icon,
      targetDate: input.targetDate ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().savingsGoals.add(row);
    return row;
  },

  async update(id: string, patch: Partial<SavingsGoalInput>): Promise<void> {
    const next: Partial<SavingsGoal> = { updatedAt: nowISO() };
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.target !== undefined) next.target = Math.abs(patch.target);
    if (patch.note !== undefined) next.note = patch.note.trim();
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.icon !== undefined) next.icon = patch.icon;
    if (patch.targetDate !== undefined) next.targetDate = patch.targetDate;
    await getDB().savingsGoals.update(id, next);
  },

  /** Soft-delete a goal and all of its contributions. */
  async remove(id: string): Promise<void> {
    const db = getDB();
    const now = nowISO();
    await db.transaction("rw", db.savingsGoals, db.savingsContributions, async () => {
      await db.savingsGoals.update(id, { deletedAt: now, updatedAt: now });
      await db.savingsContributions
        .where("goalId")
        .equals(id)
        .and((c) => !c.deletedAt)
        .modify({ deletedAt: now, updatedAt: now });
    });
  },
};

export interface ContributionInput {
  goalId: string;
  /** Positive to add, negative to withdraw. */
  amount: number;
  note?: string;
  date: string;
}

export const contributionRepo = {
  async all(): Promise<SavingsContribution[]> {
    return (await getDB().savingsContributions.toArray()).filter((c) => !c.deletedAt);
  },

  async listByGoal(goalId: string): Promise<SavingsContribution[]> {
    const rows = await getDB()
      .savingsContributions.where("goalId")
      .equals(goalId)
      .and((c) => !c.deletedAt)
      .toArray();
    rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
    return rows;
  },

  async create(input: ContributionInput): Promise<SavingsContribution> {
    const now = nowISO();
    const row: SavingsContribution = {
      id: newId(),
      goalId: input.goalId,
      amount: input.amount,
      note: input.note?.trim() ?? "",
      date: input.date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await getDB().savingsContributions.add(row);
    return row;
  },

  async update(id: string, patch: Partial<ContributionInput>): Promise<void> {
    const next: Partial<SavingsContribution> = { updatedAt: nowISO() };
    if (patch.amount !== undefined) next.amount = patch.amount;
    if (patch.note !== undefined) next.note = patch.note.trim();
    if (patch.date !== undefined) next.date = patch.date;
    await getDB().savingsContributions.update(id, next);
  },

  async remove(id: string): Promise<void> {
    const now = nowISO();
    await getDB().savingsContributions.update(id, { deletedAt: now, updatedAt: now });
  },
};
