"use client";

import { useCallback, useEffect } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export const PIN_LENGTH = 4;

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Trigger a shake + clear when a wrong PIN is entered. */
  error?: boolean;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function PinPad({ value, onChange, onComplete, error, disabled }: PinPadProps) {
  const press = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === "back") {
        onChange(value.slice(0, -1));
        return;
      }
      if (!/^\d$/.test(key)) return;
      if (value.length >= PIN_LENGTH) return;
      const next = value + key;
      onChange(next);
      if (next.length === PIN_LENGTH) onComplete?.(next);
    },
    [value, onChange, onComplete, disabled],
  );

  // Physical keyboard support.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [press]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className={cn("flex items-center gap-4", error && "animate-[shake_0.4s_ease-in-out]")}
        role="status"
        aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 transition-all duration-150",
              error
                ? "border-expense bg-expense"
                : i < value.length
                  ? "scale-110 border-primary bg-primary"
                  : "border-muted-foreground/40 bg-transparent",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              aria-label={key === "back" ? "Delete" : key}
              className={cn(
                "grid size-16 place-items-center rounded-2xl text-xl font-medium tabular-nums transition-all",
                "bg-card text-foreground shadow-sm hover:bg-accent active:scale-95 disabled:opacity-50",
                key === "back" && "text-muted-foreground",
              )}
            >
              {key === "back" ? <Delete className="size-5" /> : key}
            </button>
          ),
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
