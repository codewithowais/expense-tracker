"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HandCoins, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { StatCard } from "@/components/shared/stat-card";
import { Money } from "@/components/shared/money";
import { LoadingPanel } from "@/components/shared/states";
import { PersonDialog } from "@/components/people/person-dialog";
import { DebtEntryDialog } from "@/components/people/debt-entry-dialog";
import { balanceOf, debtKindLabel, entryDelta } from "@/lib/debts";
import { formatDate } from "@/lib/format";
import { peopleRepo, debtRepo } from "@/lib/repositories/people";
import { useDebtEntriesByPerson, usePeople, useSplitwiseByPerson } from "@/lib/hooks/use-data";
import type { DebtEntry, DebtKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 60;

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const people = usePeople();
  const entries = useDebtEntriesByPerson(id);
  const person = useMemo(() => people?.find((p) => p.id === id), [people, id]);
  const swEntries = useSplitwiseByPerson(person?.name);

  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [deletePersonOpen, setDeletePersonOpen] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ entry?: DebtEntry; kind?: DebtKind } | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<DebtEntry | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [swVisible, setSwVisible] = useState(PAGE);

  const ready = Boolean(people && entries);
  const balance = balanceOf(entries ?? []);

  // Ledger breakdown (excludes the Splitwise archive, which is shown separately).
  const gave = useMemo(
    () => (entries ?? []).reduce((s, e) => (entryDelta(e) > 0 ? s + entryDelta(e) : s), 0),
    [entries],
  );
  const owed = useMemo(
    () => (entries ?? []).reduce((s, e) => (entryDelta(e) < 0 ? s - entryDelta(e) : s), 0),
    [entries],
  );

  const caption =
    balance > 0 ? "owes you" : balance < 0 ? "you owe them" : "all settled";

  const total = entries?.length ?? 0;
  const shown = entries ? entries.slice(0, visible) : [];
  const swTotal = swEntries?.length ?? 0;
  const swShown = swEntries ? swEntries.slice(0, swVisible) : [];

  async function confirmDeletePerson() {
    if (!person) return;
    await peopleRepo.remove(person.id);
    toast.success("Person deleted");
    router.push("/people");
  }

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntry) return;
    await debtRepo.remove(pendingDeleteEntry.id);
    setPendingDeleteEntry(null);
    toast.success("Entry deleted");
  }

  if (people && !person) {
    return (
      <div className="space-y-4">
        <Link href="/people" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> People & Debts
        </Link>
        <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          This person no longer exists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/people"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> People & Debts
      </Link>

      {!ready || !person ? (
        <LoadingPanel rows={5} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                {person.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-2xl font-semibold">{person.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {balance === 0 ? (
                    "All settled"
                  ) : (
                    <>
                      {caption}{" "}
                      <Money
                        amount={Math.abs(balance)}
                        tone={balance > 0 ? "income" : "expense"}
                        className="font-semibold"
                      />
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setEntryDialog({ kind: balance > 0 ? "received" : "repaid" })}
              >
                <HandCoins className="size-4" /> <span className="hidden sm:inline">Record repayment</span>
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setEntryDialog({})}>
                <Plus className="size-4" /> Add entry
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Person actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditPersonOpen(true)}>
                    <Pencil className="size-4" /> Edit person
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeletePersonOpen(true)}>
                    <Trash2 className="size-4" /> Delete person
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="They owed you" icon={HandCoins} accent="income" value={<Money amount={gave} tone="income" />} />
            <StatCard label="You owed them" icon={HandCoins} accent="expense" value={<Money amount={owed} tone="expense" />} />
            <StatCard label="Net balance" icon={HandCoins} accent="chart-4" value={<Money amount={balance} tone="net" />} />
          </div>

          {/* Ledger history */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History
            </h2>
            {total === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No entries yet for {person.name}.
              </p>
            ) : (
              <>
                <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                  {shown.map((e, i) => (
                    <li
                      key={e.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 sm:px-4",
                        i > 0 && "border-t border-border",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{debtKindLabel(e.kind)}</p>
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
                          <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="Entry actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEntryDialog({ entry: e })}>
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setPendingDeleteEntry(e)}>
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
                {total > visible ? (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Showing {visible.toLocaleString()} of {total.toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                        Show more
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setVisible(total)}>
                        Show all
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Splitwise history (imported archive) */}
          {swTotal > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Splitwise history
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium normal-case tracking-normal text-muted-foreground tabular-nums">
                  {swTotal.toLocaleString()}
                </span>
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                {swShown.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{e.description || "Expense"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(e.date)} · {e.group}
                      </p>
                    </div>
                    <Money
                      amount={Math.abs(e.delta)}
                      tone={e.delta >= 0 ? "income" : "expense"}
                      signed
                      className="text-sm font-semibold"
                    />
                  </li>
                ))}
              </ul>
              {swTotal > swVisible ? (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Showing {swVisible.toLocaleString()} of {swTotal.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSwVisible((v) => v + PAGE)}>
                      Show more
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSwVisible(swTotal)}>
                      Show all
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      {person ? (
        <>
          <PersonDialog open={editPersonOpen} onOpenChange={setEditPersonOpen} person={person} />
          <DebtEntryDialog
            open={entryDialog !== null}
            onOpenChange={(v) => !v && setEntryDialog(null)}
            entry={entryDialog?.entry}
            presetPersonId={person.id}
            presetKind={entryDialog?.kind}
          />
        </>
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
            <AlertDialogAction onClick={confirmDeletePerson} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteEntry} onOpenChange={(v) => !v && setPendingDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from {person?.name ?? "this person"}’s history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntry} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
