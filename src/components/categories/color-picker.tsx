"use client";

import { CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Swatch picker over the finance chart color palette. */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div role="group" aria-label="Category color" className={cn("flex flex-wrap gap-2.5", className)}>
      {CATEGORY_COLORS.map((token) => {
        const selected = value === token;
        return (
          <button
            key={token}
            type="button"
            aria-label={`Color ${token.replace("chart-", "")}`}
            aria-pressed={selected}
            onClick={() => onChange(token)}
            className={cn(
              "size-9 shrink-0 rounded-full ring-offset-2 ring-offset-background transition-transform",
              selected
                ? "scale-110 ring-2 ring-foreground"
                : "ring-1 ring-border hover:scale-105 hover:ring-foreground/40",
            )}
            style={{ backgroundColor: `var(--${token})` }}
          />
        );
      })}
    </div>
  );
}
