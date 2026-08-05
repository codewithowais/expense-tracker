"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { TypeToggle } from "@/components/shared/type-toggle";
import { MoneyInput } from "@/components/shared/money-input";
import { DateField } from "@/components/shared/date-field";
import { CategorySelect } from "./category-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/constants";
import { transactionSchema, type TransactionFormValues } from "@/lib/schemas";
import { todayISO } from "@/lib/format";
import { useCategories } from "@/lib/hooks/use-data";
import type { TxType } from "@/lib/types";

interface TransactionFormProps {
  initial?: Partial<TransactionFormValues>;
  submitLabel?: string;
  onSubmit: (values: TransactionFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

export function TransactionForm({
  initial,
  submitLabel = "Save transaction",
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const categories = useCategories();
  const {
    control,
    handleSubmit,
    setValue,
    register,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initial?.type ?? "expense",
      amount: initial?.amount ?? (undefined as unknown as number),
      categoryId: initial?.categoryId ?? "",
      note: initial?.note ?? "",
      date: initial?.date ?? todayISO(),
      method: initial?.method ?? "cash",
    },
  });

  const type = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });

  // When switching ledger side, drop a category that no longer applies.
  useEffect(() => {
    if (!categories || !categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) setValue("categoryId", "");
  }, [type, categories, categoryId, setValue]);

  const hasCategories = (categories ?? []).some((c) => c.type === type);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <TypeToggle value={field.value} onChange={(v: TxType) => field.onChange(v)} />
        )}
      />

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <MoneyInput
              id="amount"
              value={field.value ?? null}
              onChange={(n) => field.onChange(n ?? undefined)}
              aria-invalid={!!errors.amount}
              autoFocus
            />
          )}
        />
        {fieldError(errors.amount?.message)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategorySelect
              id="category"
              type={type}
              value={field.value}
              onChange={field.onChange}
              aria-invalid={!!errors.categoryId}
            />
          )}
        />
        {!hasCategories ? (
          <p className="text-xs text-muted-foreground">
            No {type} categories yet.{" "}
            <Link href="/categories" className="font-medium text-primary underline-offset-2 hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : null}
        {fieldError(errors.categoryId?.message)}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                id="date"
                value={field.value}
                onChange={field.onChange}
                disableFuture
                aria-invalid={!!errors.date}
              />
            )}
          />
          {fieldError(errors.date?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Payment method</Label>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="method" className="h-11 w-full rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          className="h-11 rounded-2xl"
          placeholder="What was it for?"
          {...register("note")}
          aria-invalid={!!errors.note}
        />
        {fieldError(errors.note?.message)}
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
