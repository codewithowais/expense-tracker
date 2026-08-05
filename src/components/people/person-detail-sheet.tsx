"use client";

import { useMemo, useState } from "react";
import { HandCoins, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Money } from "@/components/shared/money";
import { PersonDialog } from "./person-dialog";
import { DebtEntryDialog } from "./debt-entry-dialog";
import { balanceOf, debtKindLabel, entryDelta } from "@/lib/debts";
import { formatDate } from "@/lib/format";
import { peopleRepo, debtRepo } from "@/lib/repositories/people";
import { useDebtEntriesByPerson, usePeople } from "@/lib/hooks/use-data";
import type { DebtEntry, DebtKind } from "@/lib/types";

interface PersonDetailSheetProps {
  personId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Detail sheet for a single person: net balance, quick actions, and full history. */
export function PersonDetailSheet({ personId, onOpenChange }: PersonDetailSheetProps) {
  const people = usePeople();
  const entries = useDebtEntriesByPerson(personId ?? "");
  const person = useMemo(() => people?.find((p) => p.id === personId), [people, personId]);

  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [deletePersonOpen, setDeletePersonOpen] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ entry?: DebtEntry; kind?: DebtKind } | null>(
    null,
  );
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<DebtEntry | null>(null);

  const balance = balanceOf(entries ?? []);
  const open = personId !== null;

  const caption =
    balance > 0
      ? `${person?.name ?? "They"} owes you`
      : balance < 0
        ? `You owe ${person?.name ?? "them"}`
        : "All settled";

  async function confirmDeletePerson() {
    if (!person) return;
    await peopleRepo.remove(person.id);
    setDeletePersonOpen(false);
    toast.success("Person deleted");
    onOpenChange(false);
  }

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntry) return;
    await debtRepo.remove(pendingDeleteEntry.id);
    setPendingDeleteEntry(null);
    toast.success("Entry deleted");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          {person ? (
            <>
              <SheetHeader className="gap-3 border-b border-border px-6 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <SheetTitle className="truncate font-heading text-xl">
                      {person.name}
                    </SheetTitle>
                    <SheetDescription>{caption}</SheetDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground"
                        aria-label="Person actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditPersonOpen(true)}>
                        <Pencil className="size-4" /> Edit person
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeletePersonOpen(true)}
                      >
                        <Trash2 className="size-4" /> Delete person
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {balance === 0 ? (
                  <p className="font-heading text-3xl font-semibold text-muted-foreground">
                    Settled
                  </p>
                ) : (
                  <Money
                    amount={Math.abs(balance)}
                    tone={balance > 0 ? "income" : "expense"}
                    className="font-heading text-3xl font-semibold"
                  />
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      setEntryDialog({ kind: balance > 0 ? "received" : "repaid" })
                    }
                  >
                    <HandCoins className="size-4" /> Record repayment
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setEntryDialog({})}
                  >
                    <Plus className="size-4" /> Add entry
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-3 px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  History
                </h3>
                {!entries ? null : entries.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    No entries yet for {person.name}.
                  </p>
                ) : (
                  <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                    {entries.map((e, i) => (
                      <li
                        key={e.id}
                        className={
                          i > 0
                            ? "flex items-center gap-3 border-t border-border px-3 py-3 sm:px-4"
                            : "flex items-center gap-3 px-3 py-3 sm:px-4"
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {debtKindLabel(e.kind)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(e.date)}
                            {e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                        <Money
                          amount={Math.abs(entryDelta(e))}
                          tone={entryDelta(e) >= 0 ? "income" : "expense"}
                          signed
                          className="text-sm font-semibold sm:text-base"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground"
                              aria-label="Entry actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEntryDialog({ entry: e })}>
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteEntry(e)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {person ? (
        <PersonDialog open={editPersonOpen} onOpenChange={setEditPersonOpen} person={person} />
      ) : null}

      {person ? (
        <DebtEntryDialog
          open={entryDialog !== null}
          onOpenChange={(v) => !v && setEntryDialog(null)}
          entry={entryDialog?.entry}
          presetPersonId={person.id}
          presetKind={entryDialog?.kind}
        />
      ) : null}

      <AlertDialog open={deletePersonOpen} onOpenChange={setDeletePersonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {person?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them and their entire debt history. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePerson}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeleteEntry}
        onOpenChange={(v) => !v && setPendingDeleteEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from {person?.name ?? "this person"}’s history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEntry}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
