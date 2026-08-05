"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRESETS,
  rangeLabel,
  shiftMonthRange,
  type DateRange,
  type PresetKey,
} from "@/lib/dates";

interface MonthSwitcherProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  monthStartDay?: number;
  /** Prevent navigating past the current month. */
  maxToday?: boolean;
}

export function MonthSwitcher({ range, onChange, monthStartDay = 1, maxToday = true }: MonthSwitcherProps) {
  const next = shiftMonthRange(range, 1, monthStartDay);
  const atCurrent = maxToday && next.start > new Date().toISOString().slice(0, 10);

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-xl"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonthRange(range, -1, monthStartDay))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold tabular-nums">
        {rangeLabel(range)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-xl"
        aria-label="Next month"
        disabled={atCurrent}
        onClick={() => onChange(next)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

interface PresetSelectProps {
  value: PresetKey;
  onChange: (key: PresetKey) => void;
}

export function PresetSelect({ value, onChange }: PresetSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PresetKey)}>
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((p) => (
          <SelectItem key={p.key} value={p.key}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
