"use client";

import { forwardRef, useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/constants";
import { parseMoneyInput } from "@/lib/format";
import { useMoney } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  autoFocus?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  size?: "md" | "lg";
}

/**
 * Currency-aware amount field. Accepts free-form input ("1,250", "1.2k") and
 * emits a parsed number, while keeping the raw text the user typed.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, id, autoFocus, className, size = "lg", ...rest },
  ref,
) {
  const { code } = useMoney();
  const symbol = CURRENCIES[code].symbol;
  const decimals = CURRENCIES[code].decimals;
  const [text, setText] = useState(value != null ? String(value) : "");

  // Sync inbound value (e.g. when editing) without clobbering active typing.
  useEffect(() => {
    if (value == null) {
      if (text !== "") setText("");
    } else if (parseMoneyInput(text, decimals) !== value) {
      setText(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <span
        className={cn(
          "pointer-events-none absolute left-4 font-medium text-muted-foreground tabular-nums",
          size === "lg" ? "text-2xl" : "text-base",
        )}
      >
        {symbol}
      </span>
      <input
        ref={ref}
        id={id}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(raw.trim() === "" ? null : parseMoneyInput(raw, decimals));
        }}
        onBlur={() => {
          // Normalize the display to the actual stored (rounded) value so what
          // you see matches what's saved — e.g. "100.5" → "101" for PKR.
          const parsed = parseMoneyInput(text, decimals);
          setText(parsed != null ? String(parsed) : "");
        }}
        className={cn(
          "w-full border border-input bg-transparent pr-4 font-heading font-semibold tabular-nums outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
          size === "lg" ? "h-16 rounded-2xl pl-11 text-3xl" : "h-11 rounded-xl pl-9 text-base",
        )}
        {...rest}
      />
    </div>
  );
});
