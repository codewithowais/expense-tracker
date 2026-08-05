"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { settingsRepo } from "@/lib/repositories/settings";
import { categoryRepo } from "@/lib/repositories/categories";
import { transactionRepo, type TransactionFilter } from "@/lib/repositories/transactions";
import { budgetRepo } from "@/lib/repositories/budgets";
import { debtRepo, peopleRepo } from "@/lib/repositories/people";
import { contributionRepo, savingsGoalRepo } from "@/lib/repositories/savings";
import { formatCurrency } from "@/lib/format";
import type { AppSettings, Category, CurrencyCode } from "@/lib/types";

/** Reactive settings singleton. `undefined` while the first read resolves. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => settingsRepo.get(), []);
}

/** A currency formatter bound to the user's active currency. */
export function useMoney() {
  const settings = useSettings();
  const code: CurrencyCode = settings?.currency ?? "PKR";
  const fmt = useCallback(
    (amount: number, options?: { compact?: boolean; signed?: boolean }) =>
      formatCurrency(amount, code, options),
    [code],
  );
  return { fmt, code, ready: settings !== undefined };
}

export function useCategories(includeArchived = false): Category[] | undefined {
  return useLiveQuery(() => categoryRepo.list(includeArchived), [includeArchived]);
}

export function useTransactions(filter: TransactionFilter) {
  // Serialize the filter so the query re-runs whenever any field changes.
  const key = JSON.stringify(filter);
  return useLiveQuery(() => transactionRepo.query(filter), [key]);
}

export function useBudgets() {
  return useLiveQuery(() => budgetRepo.list(), []);
}

export function useTransactionCount(): number | undefined {
  return useLiveQuery(() => transactionRepo.count(), []);
}

export function usePeople() {
  return useLiveQuery(() => peopleRepo.list(), []);
}

export function useDebtEntries() {
  return useLiveQuery(() => debtRepo.all(), []);
}

export function useDebtEntriesByPerson(personId: string) {
  return useLiveQuery(() => debtRepo.listByPerson(personId), [personId]);
}

export function useSavingsGoals() {
  return useLiveQuery(() => savingsGoalRepo.list(), []);
}

export function useSavingsContributions() {
  return useLiveQuery(() => contributionRepo.all(), []);
}

export function useContributionsByGoal(goalId: string) {
  return useLiveQuery(() => contributionRepo.listByGoal(goalId), [goalId]);
}
