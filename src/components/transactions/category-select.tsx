"use client";

import { CategoryIcon } from "@/components/shared/category-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/lib/hooks/use-data";
import type { TxType } from "@/lib/types";

interface CategorySelectProps {
  type: TxType;
  value: string;
  onChange: (id: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  includeAll?: boolean;
}

export function CategorySelect({
  type,
  value,
  onChange,
  id,
  includeAll,
  ...rest
}: CategorySelectProps) {
  const categories = useCategories();
  const options = (categories ?? []).filter((c) => c.type === type);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" {...rest}>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">All categories</SelectItem> : null}
        <SelectGroup>
          <SelectLabel>{type === "income" ? "Income" : "Expense"} categories</SelectLabel>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2.5">
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                {c.name}
              </span>
            </SelectItem>
          ))}
          {options.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No categories yet
            </div>
          ) : null}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
