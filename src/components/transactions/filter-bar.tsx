"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "@/components/transactions/category-select";
import { PresetSelect } from "@/components/shared/period-controls";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod, TxType } from "@/lib/types";
import type { TxSort } from "@/lib/repositories/transactions";
import type { PresetKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type TxTypeFilter = "all" | TxType;

export interface TransactionFiltersValue {
  search: string;
  type: TxTypeFilter;
  /** `null` means "all categories" (only meaningful when `type` is not "all"). */
  categoryId: string | null;
  method: PaymentMethod | "all";
  sort: TxSort;
  preset: PresetKey;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFiltersValue = {
  search: "",
  type: "all",
  categoryId: null,
  method: "all",
  sort: "date-desc",
  preset: "this-month",
};

export function isFilterActive(value: TransactionFiltersValue): boolean {
  return (
    value.search.trim() !== "" ||
    value.type !== "all" ||
    value.categoryId !== null ||
    value.method !== "all" ||
    value.sort !== "date-desc" ||
    value.preset !== "this-month"
  );
}

const SORT_OPTIONS: { value: TxSort; label: string }[] = [
  { value: "date-desc", label: "Newest" },
  { value: "date-asc", label: "Oldest" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

const SEARCH_DEBOUNCE_MS = 250;

interface FilterBarProps {
  value: TransactionFiltersValue;
  onChange: (value: TransactionFiltersValue) => void;
  className?: string;
}

/** Reusable search / type / category / method / sort / period toolbar for the ledger. */
export function FilterBar({ value, onChange, className }: FilterBarProps) {
  const [searchText, setSearchText] = useState(value.search);
  // Tracks the last externally-applied search value (e.g. from Reset) so we
  // can resync the local input during render without an effect — the
  // React-recommended pattern for "adjusting state when a prop changes".
  const [syncedSearch, setSyncedSearch] = useState(value.search);
  if (value.search !== syncedSearch) {
    setSyncedSearch(value.search);
    setSearchText(value.search);
  }

  useEffect(() => {
    if (searchText === value.search) return;
    const timer = setTimeout(() => {
      onChange({ ...value, search: searchText });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, value, onChange]);

  const active = isFilterActive(value);

  function update<K extends keyof TransactionFiltersValue>(
    key: K,
    val: TransactionFiltersValue[K],
  ) {
    onChange({ ...value, [key]: val });
  }

  function handleTypeChange(type: TxTypeFilter) {
    // A category filter from a different ledger side is meaningless once the
    // type changes, so drop it rather than silently filtering on a stale id.
    onChange({ ...value, type, categoryId: null });
  }

  function reset() {
    setSearchText(DEFAULT_TRANSACTION_FILTERS.search);
    onChange(DEFAULT_TRANSACTION_FILTERS);
  }

  return (
    <Card className={cn("gap-4 p-4", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Label htmlFor="tx-search" className="sr-only">
              Search transactions by note
            </Label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="tx-search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by note…"
              className="h-10 rounded-xl pr-9 pl-9"
            />
            {searchText ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground"
                onClick={() => setSearchText("")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <Tabs value={value.type} onValueChange={(v) => handleTypeChange(v as TxTypeFilter)}>
            <TabsList aria-label="Filter by transaction type">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          {value.type !== "all" ? (
            <div className="col-span-2 sm:w-48">
              <Label htmlFor="tx-category" className="sr-only">
                Filter by category
              </Label>
              <CategorySelect
                id="tx-category"
                type={value.type}
                value={value.categoryId ?? "all"}
                onChange={(id) => update("categoryId", id === "all" ? null : id)}
                includeAll
              />
            </div>
          ) : null}

          <div className="sm:w-40">
            <Label htmlFor="tx-method" className="sr-only">
              Filter by payment method
            </Label>
            <Select
              value={value.method}
              onValueChange={(v) => update("method", v as PaymentMethod | "all")}
            >
              <SelectTrigger id="tx-method" className="h-10 w-full rounded-xl">
                <SelectValue placeholder="All methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:w-40">
            <Label htmlFor="tx-sort" className="sr-only">
              Sort transactions
            </Label>
            <Select value={value.sort} onValueChange={(v) => update("sort", v as TxSort)}>
              <SelectTrigger id="tx-sort" className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:w-[170px]">
            <PresetSelect value={value.preset} onChange={(key) => update("preset", key)} />
          </div>

          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground sm:ml-auto"
              onClick={reset}
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
