"use client";

import { useState } from "react";
import { parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  disableFuture?: boolean;
  "aria-invalid"?: boolean;
}

export function DateField({
  value,
  onChange,
  id,
  className,
  disableFuture,
  "aria-invalid": ariaInvalid,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          className={cn("h-11 w-full justify-start gap-2 rounded-2xl font-normal", className)}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {value ? formatDate(value, "medium") : "Select date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(toISODate(d));
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
