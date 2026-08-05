"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TxType } from "@/lib/types";

interface TypeToggleProps {
  value: TxType;
  onChange: (value: TxType) => void;
  className?: string;
}

/** Segmented Expense/Income switch with semantic coloring. */
export function TypeToggle({ value, onChange, className }: TypeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Transaction type"
      className={cn("grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "expense"}
        onClick={() => onChange("expense")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
          value === "expense"
            ? "bg-expense-soft text-expense shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <TrendingDown className="size-4" /> Expense
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "income"}
        onClick={() => onChange("income")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
          value === "income"
            ? "bg-income-soft text-income shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <TrendingUp className="size-4" /> Income
      </button>
    </div>
  );
}
