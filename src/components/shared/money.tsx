"use client";

import { useMoney } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";
import type { TxType } from "@/lib/types";

interface MoneyProps {
  amount: number;
  /** Color and sign the figure by ledger side. */
  tone?: TxType | "net" | "plain";
  /** Prefix an explicit +/− sign. */
  signed?: boolean;
  compact?: boolean;
  className?: string;
}

/** Consistent, tabular, currency-aware money figure. */
export function Money({ amount, tone = "plain", signed, compact, className }: MoneyProps) {
  const { fmt } = useMoney();

  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : tone === "net"
          ? amount >= 0
            ? "text-income"
            : "text-expense"
          : undefined;

  const display =
    tone === "expense" && signed
      ? `−${fmt(amount, { compact })}`
      : tone === "income" && signed
        ? `+${fmt(amount, { compact })}`
        : fmt(amount, { compact, signed: signed && tone === "net" });

  return <span className={cn("tnum tabular-nums", toneClass, className)}>{display}</span>;
}
