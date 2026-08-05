"use client";

import { HandCoins, Scale, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Money } from "@/components/shared/money";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { summarizePeople } from "@/lib/debts";
import { relativeDay } from "@/lib/format";
import type { DebtEntry, Person } from "@/lib/types";
import { ReportSection, TableFrame } from "./report-primitives";

interface PeopleReportProps {
  people: Person[];
  debtEntries: DebtEntry[];
}

export function PeopleReport({ people, debtEntries }: PeopleReportProps) {
  const { summaries, owedToYou, youOwe, net } = summarizePeople(people, debtEntries);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 break-inside-avoid sm:grid-cols-3 print:grid-cols-3 print:gap-3">
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
          label="Net position"
          icon={Scale}
          accent="chart-4"
          value={<Money amount={net} tone="net" />}
        />
      </div>

      <ReportSection
        title="Who owes whom"
        description="Current outstanding balance for each person, across their entire history."
      >
        {summaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
            No people or debts recorded yet.
          </div>
        ) : (
          <TableFrame>
            <Table>
              <TableCaption className="sr-only">
                Each person with their outstanding balance, entry count, and last activity
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Person</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">
                    Entries
                  </TableHead>
                  <TableHead scope="col">Last activity</TableHead>
                  <TableHead scope="col" className="text-right">
                    Balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map(({ person, balance, entryCount, lastActivity }) => {
                  const settled = balance === 0;
                  const owesYou = balance > 0;
                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium">{person.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {settled ? "Settled" : owesYou ? "Owes you" : "You owe"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {entryCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {lastActivity ? relativeDay(lastActivity) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {settled ? (
                          <span className="tabular-nums text-muted-foreground">—</span>
                        ) : (
                          <Money
                            amount={Math.abs(balance)}
                            tone={owesYou ? "income" : "expense"}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </ReportSection>
    </div>
  );
}
