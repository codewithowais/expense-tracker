"use client";

import { CATEGORY_ICONS } from "@/lib/constants";
import { resolveIcon } from "@/lib/icon-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Scrollable grid of curated lucide icons for a category. */
export function IconPicker({ value, onChange, className }: IconPickerProps) {
  return (
    <ScrollArea className={cn("h-48 rounded-2xl border border-border", className)}>
      <div
        role="group"
        aria-label="Category icon"
        className="grid grid-cols-5 gap-2 p-3 sm:grid-cols-6"
      >
        {CATEGORY_ICONS.map((name) => {
          const Icon = resolveIcon(name);
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={selected}
              onClick={() => onChange(name)}
              className={cn(
                "grid size-10 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
