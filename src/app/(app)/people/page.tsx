"use client";

import { useMemo, useState } from "react";
import { HandCoins, Plus, Scale, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCardsSkeleton, LoadingPanel } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { PersonDialog } from "@/components/people/person-dialog";
import { DebtEntryDialog } from "@/components/people/debt-entry-dialog";
import { PersonDetailSheet } from "@/components/people/person-detail-sheet";
import { summarizePeople } from "@/lib/debts";
import { relativeDay } from "@/lib/format";
import { useDebtEntries, usePeople } from "@/lib/hooks/use-data";

export default function PeoplePage() {
  const people = usePeople();
  const entries = useDebtEntries();
  const ready = Boolean(people && entries);

  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const { summaries, owedToYou, youOwe, net } = useMemo(
    () => summarizePeople(people ?? [], entries ?? []),
    [people, entries],
  );

  const hasPeople = (people?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & Debts"
        description="Track who owes you and who you owe — kept separate from your spending."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setPersonDialogOpen(true)}
            >
              <Plus className="size-4" /> Add person
            </Button>
            <Button
              className="gap-2"
              onClick={() => setDebtDialogOpen(true)}
              disabled={!ready || !hasPeople}
              title={ready && !hasPeople ? "Add a person first" : undefined}
            >
              <Plus className="size-4" /> Record debt
            </Button>
          </>
        }
      />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={3} />
          <LoadingPanel rows={4} />
        </div>
      ) : !hasPeople ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          description="Add someone you lend money to or borrow money from to start tracking balances."
          action={
            <div className="flex flex-col items-center gap-3">
              <Button className="gap-2" onClick={() => setPersonDialogOpen(true)}>
                <Plus className="size-4" /> Add person
              </Button>
              <p className="max-w-sm text-xs text-muted-foreground">
                This ledger is kept separate from your income and expenses.
              </p>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Owed to you"
              icon={HandCoins}
              accent="income"
              value={<Money amount={owedToYou} tone="income" />}
            />
            <StatCard
              label="You owe"
              icon={Wallet}
              accent="expense"
              value={<Money amount={youOwe} tone="expense" />}
            />
            <StatCard
              label="Net"
              icon={Scale}
              accent="chart-4"
              value={<Money amount={net} tone="net" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map(({ person, balance, entryCount, lastActivity }) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPersonId(person.id)}
                className="card-interactive flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-accent/40"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {person.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{person.name}</p>
                  {balance === 0 ? (
                    <p className="text-sm text-muted-foreground">Settled</p>
                  ) : (
                    <p className="text-sm">
                      <span className={balance > 0 ? "text-income" : "text-expense"}>
                        {balance > 0 ? "owes you " : "you owe "}
                        <Money amount={Math.abs(balance)} tone={balance > 0 ? "income" : "expense"} />
                      </span>
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {entryCount} {entryCount === 1 ? "entry" : "entries"}
                    {lastActivity ? ` · ${relativeDay(lastActivity)}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <PersonDialog open={personDialogOpen} onOpenChange={setPersonDialogOpen} />
      <DebtEntryDialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen} />
      <PersonDetailSheet
        personId={selectedPersonId}
        onOpenChange={(v) => !v && setSelectedPersonId(null)}
      />
    </div>
  );
}
