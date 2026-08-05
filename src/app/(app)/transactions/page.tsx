"use client";

import { useMemo, useState } from "react";
import { Plus, SearchX, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPanel } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/transactions/transaction-list";
import {
  DEFAULT_TRANSACTION_FILTERS,
  FilterBar,
  type TransactionFiltersValue,
} from "@/components/transactions/filter-bar";
import { totals } from "@/lib/analytics";
import { presetRange } from "@/lib/dates";
import {
  useCategories,
  useSettings,
  useTransactionCount,
  useTransactions,
} from "@/lib/hooks/use-data";
import type { TransactionFilter } from "@/lib/repositories/transactions";
import { useQuickAdd } from "@/stores/ui-store";

export default function TransactionsPage() {
  const settings = useSettings();
  const monthStartDay = settings?.monthStartDay ?? 1;
  const openCreate = useQuickAdd((s) => s.openCreate);

  const [filters, setFilters] = useState<TransactionFiltersValue>(DEFAULT_TRANSACTION_FILTERS);

  const filter: TransactionFilter = useMemo(() => {
    const range = presetRange(filters.preset, new Date(), monthStartDay);
    const f: TransactionFilter = { range, sort: filters.sort };
    if (filters.type !== "all") f.types = [filters.type];
    if (filters.categoryId) f.categoryIds = [filters.categoryId];
    if (filters.method !== "all") f.methods = [filters.method];
    if (filters.search.trim()) f.search = filters.search.trim();
    return f;
  }, [filters, monthStartDay]);

  const txs = useTransactions(filter);
  const categories = useCategories();
  const totalCount = useTransactionCount();

  const summary = useMemo(() => totals(txs ?? []), [txs]);

  const loading = txs === undefined || categories === undefined || totalCount === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every income and expense, searchable."
        actions={
          <Button className="gap-2" onClick={() => openCreate()}>
            <Plus className="size-4" /> Add transaction
          </Button>
        }
      />

      <FilterBar value={filters} onChange={setFilters} />

      {loading ? (
        <LoadingPanel rows={6} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No transactions yet"
          description="Add your first income or expense to start building your ledger."
          action={
            <Button className="gap-2" onClick={() => openCreate()}>
              <Plus className="size-4" /> Add transaction
            </Button>
          }
        />
      ) : txs.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches"
          description="Try a different search term or loosen your filters."
          action={
            <Button variant="outline" onClick={() => setFilters(DEFAULT_TRANSACTION_FILTERS)}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{txs.length}</span>{" "}
              {txs.length === 1 ? "transaction" : "transactions"}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Income <Money amount={summary.income} tone="income" signed />
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Expenses <Money amount={summary.expense} tone="expense" signed />
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Net <Money amount={summary.net} tone="net" signed />
              </span>
            </div>
          </div>

          <TransactionList transactions={txs} categories={categories} grouped />
        </>
      )}
    </div>
  );
}
