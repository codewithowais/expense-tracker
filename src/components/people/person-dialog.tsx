"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { peopleRepo } from "@/lib/repositories/people";
import { personSchema, type PersonFormValues } from "@/lib/schemas";
import type { Person } from "@/lib/types";

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this person instead of creating one. */
  person?: Person;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

function defaultsFor(person?: Person): PersonFormValues {
  return {
    name: person?.name ?? "",
    note: person?.note ?? "",
  };
}

/** Create/edit dialog for a person in the People & Debts ledger. */
export function PersonDialog({ open, onOpenChange, person }: PersonDialogProps) {
  const isEdit = Boolean(person);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: defaultsFor(person),
  });

  // Reset only when the dialog opens or the *target* changes (keyed by id) —
  // NOT on every `person` object identity change. `usePeople()` re-emits a new
  // array (new object refs) on any write to the table, incl. a background sync
  // pull; depending on the object would wipe whatever the user is typing.
  useEffect(() => {
    if (open) reset(defaultsFor(person));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.id]);

  async function onSubmit(values: PersonFormValues) {
    try {
      if (person) {
        await peopleRepo.update(person.id, values);
        toast.success("Person updated");
      } else {
        await peopleRepo.create(values);
        toast.success("Person added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit person" : "Add person"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update their name or note."
              : "Add someone you lend money to or borrow money from."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              placeholder="e.g. Bilal"
              {...register("name")}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {fieldError(errors.name?.message)}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-note">Note (optional)</Label>
            <Textarea
              id="person-note"
              placeholder="Any context worth remembering"
              rows={3}
              {...register("note")}
              aria-invalid={!!errors.note}
            />
            {fieldError(errors.note?.message)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
