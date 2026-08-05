"use client";

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/shared/money-input";
import { DateField } from "@/components/shared/date-field";
import { debtRepo } from "@/lib/repositories/people";
import { debtEntrySchema, type DebtEntryFormValues } from "@/lib/schemas";
import { todayISO } from "@/lib/format";
import { usePeople } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";
import type { DebtEntry, DebtKind } from "@/lib/types";

interface DebtEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this entry instead of creating one. */
  entry?: DebtEntry;
  /** Lock the person to this id and hide the person picker. */
  presetPersonId?: string;
  /** Preselect a kind (still editable unless a person is also preset for a repayment flow). */
  presetKind?: DebtKind;
}

const KIND_OPTIONS: { value: DebtKind; label: string; helper: string }[] = [
  { value: "lent", label: "Lent", helper: "Money you gave" },
  { value: "received", label: "Received", helper: "They paid you back" },
  { value: "borrowed", label: "Borrowed", helper: "Money you took" },
  { value: "repaid", label: "Repaid", helper: "You paid them back" },
];

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

/** Create/edit dialog for a single debt entry (lent/received/borrowed/repaid). */
export function DebtEntryDialog({
  open,
  onOpenChange,
  entry,
  presetPersonId,
  presetKind,
}: DebtEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {open ? (
          <DebtEntryDialogForm
            key={`${entry?.id ?? "new"}-${presetPersonId ?? ""}-${presetKind ?? ""}`}
            entry={entry}
            presetPersonId={presetPersonId}
            presetKind={presetKind}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface DebtEntryDialogFormProps {
  entry?: DebtEntry;
  presetPersonId?: string;
  presetKind?: DebtKind;
  onDone: () => void;
  onCancel: () => void;
}

function DebtEntryDialogForm({
  entry,
  presetPersonId,
  presetKind,
  onDone,
  onCancel,
}: DebtEntryDialogFormProps) {
  const people = usePeople();
  const isEdit = Boolean(entry);
  const lockedPersonId = presetPersonId ?? entry?.personId;
  const showPersonField = !presetPersonId;

  const personOptions = useMemo(() => people ?? [], [people]);
  const lockedPerson = useMemo(
    () => personOptions.find((p) => p.id === lockedPersonId),
    [personOptions, lockedPersonId],
  );

  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<DebtEntryFormValues>({
    resolver: zodResolver(debtEntrySchema),
    defaultValues: {
      personId: entry?.personId ?? presetPersonId ?? "",
      kind: entry?.kind ?? presetKind ?? "lent",
      amount: entry?.amount ?? (undefined as unknown as number),
      note: entry?.note ?? "",
      date: entry?.date ?? todayISO(),
    },
  });

  async function onSubmit(values: DebtEntryFormValues) {
    try {
      if (entry) {
        await debtRepo.update(entry.id, values);
        toast.success("Entry updated");
      } else {
        await debtRepo.create(values);
        toast.success("Entry recorded");
      }
      onDone();
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit entry" : "Record debt"}</DialogTitle>
        <DialogDescription>
          {showPersonField
            ? "Log money lent, borrowed, or repaid with someone."
            : `Log an entry for ${lockedPerson?.name ?? "this person"}.`}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {showPersonField ? (
          <div className="space-y-1.5">
            <Label htmlFor="debt-person">Person</Label>
            <Controller
              control={control}
              name="personId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="debt-person"
                    className="w-full"
                    aria-invalid={!!errors.personId}
                  >
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {personOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {personOptions.length === 0 ? (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No people yet
                      </div>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
            />
            {fieldError(errors.personId?.message)}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>What kind of entry is this?</Label>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid grid-cols-2 gap-2"
              >
                {KIND_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-2xl border border-input px-3 py-2.5 text-sm transition-colors",
                      field.value === opt.value ? "border-primary bg-accent" : undefined,
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.helper}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="debt-amount">Amount</Label>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="debt-amount"
                size="md"
                value={field.value ?? null}
                onChange={(n) => field.onChange(n ?? undefined)}
                aria-invalid={!!errors.amount}
                autoFocus={!showPersonField}
              />
            )}
          />
          {fieldError(errors.amount?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="debt-date">Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                id="debt-date"
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
          <Label htmlFor="debt-note">Note (optional)</Label>
          <Input
            id="debt-note"
            placeholder="What was it for?"
            {...register("note")}
            aria-invalid={!!errors.note}
          />
          {fieldError(errors.note?.message)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Record entry"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
