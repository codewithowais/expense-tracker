"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportId } from "@/lib/reports";

export interface ReportOption {
  id: ReportId;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface ReportPickerProps {
  options: ReportOption[];
  value: ReportId;
  onChange: (id: ReportId) => void;
  className?: string;
}

/**
 * The report chooser. A 2-column grid of compact cards on small screens,
 * a sticky vertical rail with descriptions on desktop. Hidden when printing.
 */
export function ReportPicker({ options, value, onChange, className }: ReportPickerProps) {
  return (
    <nav
      aria-label="Report type"
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:gap-1.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(opt.id)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card hover:bg-accent/40",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-[1.05rem]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-medium",
                  active ? "text-foreground" : "text-foreground/90",
                )}
              >
                {opt.label}
              </span>
              <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
                {opt.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
