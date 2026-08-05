import { describe, expect, it } from "vitest";
import { parseMoneyInput, roundMoney, sumMoney, formatPercent } from "../format";
import { monthRange, shiftMonthRange, presetRange, rangeDays, monthsInRange } from "../dates";
import {
  budgetProgress,
  byCategory,
  pctChange,
  savingsRate,
  totals,
} from "../analytics";
import { toCSV, parseCSV } from "../csv";
import { balanceOf, summarizePeople } from "../debts";
import { savedForGoal, summarizeGoals } from "../savings";
import type {
  Budget,
  Category,
  DebtEntry,
  DebtKind,
  Person,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../types";

function cat(id: string, type: Category["type"], name = id): Category {
  return {
    id,
    name,
    type,
    color: "chart-1",
    icon: "ShoppingCart",
    isDefault: false,
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    deletedAt: null,
  };
}

function tx(p: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "categoryId">): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    type: p.type,
    amount: p.amount,
    categoryId: p.categoryId,
    note: p.note ?? "",
    date: p.date ?? "2024-06-15",
    method: p.method ?? "cash",
    createdAt: p.createdAt ?? "2024-06-15T00:00:00Z",
    updatedAt: p.updatedAt ?? "2024-06-15T00:00:00Z",
    deletedAt: null,
  };
}

describe("money math", () => {
  it("sums without floating point drift", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([10.05, 20.1, 5.85])).toBe(36);
  });

  it("rounds to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1);
    expect(roundMoney(2.675)).toBe(2.68);
  });

  it("parses free-form money input", () => {
    expect(parseMoneyInput("1,250.50")).toBe(1250.5);
    expect(parseMoneyInput("Rs 1250")).toBe(1250);
    expect(parseMoneyInput("1.2k")).toBe(1200);
    expect(parseMoneyInput("3m")).toBe(3_000_000);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });

  it("rejects garbage instead of returning a wrong number", () => {
    // Regression: these previously mis-parsed to 15 and 5,000,000,000.
    expect(parseMoneyInput("1e5")).toBeNull();
    expect(parseMoneyInput("5abc")).toBeNull();
    expect(parseMoneyInput("1.2.3")).toBeNull();
    expect(parseMoneyInput("$5b")).toBe(5_000_000_000); // legit suffix still works
  });

  it("rounds to the currency's decimal precision", () => {
    expect(parseMoneyInput("100.55", 0)).toBe(101); // PKR (0 decimals)
    expect(parseMoneyInput("100.55", 2)).toBe(100.55);
  });

  it("accepts an in-progress trailing decimal point (no field-wipe)", () => {
    // Regression: "12." must parse to 12, not null, so typing "12.50" isn't wiped.
    expect(parseMoneyInput("12.")).toBe(12);
    expect(parseMoneyInput(".5")).toBe(0.5);
    expect(parseMoneyInput("12.50")).toBe(12.5);
  });

  it("rounds and sums negatives symmetrically", () => {
    expect(roundMoney(-100.5, 0)).toBe(-101);
    expect(roundMoney(-2.675)).toBe(-2.68);
    // sumMoney stays consistent with roundMoney for negative halves.
    expect(sumMoney([-2.675])).toBe(-2.68);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });

  it("formats percentages", () => {
    expect(formatPercent(42.4)).toBe("42%");
    expect(formatPercent(42.45, 1)).toBe("42.5%");
  });
});

describe("date ranges", () => {
  it("computes a calendar month by default", () => {
    const r = monthRange(new Date(2024, 5, 15));
    expect(r.start).toBe("2024-06-01");
    expect(r.end).toBe("2024-06-30");
  });

  it("honors a salary-cycle start day", () => {
    const r = monthRange(new Date(2024, 5, 10), 25);
    expect(r.start).toBe("2024-05-25");
    expect(r.end).toBe("2024-06-24");
  });

  it("clamps monthStartDay to avoid month overflow", () => {
    // Regression: day 31 in a short month must not roll Date into the next month.
    const r = monthRange(new Date(2024, 1, 10), 31);
    expect(r.start).toBe("2024-01-28"); // clamped to 28th
    expect(r.end).toBe("2024-02-27");
  });

  it("shifts months", () => {
    const r = monthRange(new Date(2024, 5, 15));
    const prev = shiftMonthRange(r, -1);
    expect(prev.start).toBe("2024-05-01");
    expect(prev.end).toBe("2024-05-31");
  });

  it("builds preset ranges and counts days", () => {
    const r = presetRange("this-month", new Date(2024, 1, 10));
    expect(r.start).toBe("2024-02-01");
    expect(rangeDays(r)).toBe(29); // leap year February
    // last-3-months spans the current month plus the two before it.
    expect(monthsInRange(presetRange("last-3-months", new Date(2024, 5, 1)))).toHaveLength(3);
  });
});

describe("analytics", () => {
  const cats = [cat("food", "expense", "Food"), cat("rent", "expense", "Rent"), cat("job", "income", "Job")];
  const txs = [
    tx({ type: "income", amount: 1000, categoryId: "job" }),
    tx({ type: "expense", amount: 300, categoryId: "food" }),
    tx({ type: "expense", amount: 200, categoryId: "food" }),
    tx({ type: "expense", amount: 500, categoryId: "rent" }),
  ];

  it("totals income, expense and net", () => {
    const t = totals(txs);
    expect(t.income).toBe(1000);
    expect(t.expense).toBe(1000);
    expect(t.net).toBe(0);
    expect(t.count).toBe(4);
  });

  it("computes savings rate", () => {
    expect(savingsRate(totals([tx({ type: "income", amount: 100, categoryId: "job" })]))).toBe(100);
    expect(savingsRate({ income: 0, expense: 50, net: -50, count: 1 })).toBe(0);
  });

  it("breaks down by category with percentages", () => {
    const slices = byCategory(txs, cats, "expense");
    expect(slices).toHaveLength(2);
    // food (300+200) and rent (500) are tied at 500 → 50% each.
    expect(slices.every((s) => s.total === 500)).toBe(true);
    expect(slices.every((s) => Math.abs(s.pct - 50) < 1e-5)).toBe(true);
    expect(slices.find((s) => s.categoryId === "food")?.count).toBe(2);
  });

  it("computes budget progress and status", () => {
    const budgets: Budget[] = [
      { id: "b1", scope: "category", categoryId: "food", amount: 400, createdAt: "", updatedAt: "", deletedAt: null },
      { id: "b2", scope: "overall", categoryId: null, amount: 2000, createdAt: "", updatedAt: "", deletedAt: null },
    ];
    const progress = budgetProgress(budgets, txs, cats);
    const food = progress.find((p) => p.budget.id === "b1")!;
    expect(food.spent).toBe(500);
    expect(food.status).toBe("over");
    expect(food.remaining).toBe(-100);
    const overall = progress.find((p) => p.budget.id === "b2")!;
    expect(overall.spent).toBe(1000);
    expect(overall.status).toBe("under");
    // overall sorts first
    expect(progress[0].budget.id).toBe("b2");
  });

  it("computes percentage change with a null baseline", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});

describe("people & debts", () => {
  const person = (id: string, name = id): Person => ({
    id,
    name,
    note: "",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    deletedAt: null,
  });
  const entry = (personId: string, kind: DebtKind, amount: number, date = "2024-06-10"): DebtEntry => ({
    id: Math.random().toString(36).slice(2),
    personId,
    kind,
    amount,
    note: "",
    date,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
    deletedAt: null,
  });

  it("nets lending and repayments (positive = they owe you)", () => {
    // Lent 10000, they repaid 4000 → they still owe 6000.
    expect(balanceOf([entry("s", "lent", 10000), entry("s", "received", 4000)])).toBe(6000);
    // Borrowed 5000, repaid 2000 → you still owe 3000.
    expect(balanceOf([entry("r", "borrowed", 5000), entry("r", "repaid", 2000)])).toBe(-3000);
  });

  it("summarizes owed-to-you vs. you-owe across people", () => {
    const people = [person("s", "Sarah"), person("r", "Raza"), person("z", "Zed")];
    const entries = [
      entry("s", "lent", 10000),
      entry("s", "received", 4000), // Sarah owes 6000
      entry("r", "borrowed", 5000), // you owe Raza 5000
      entry("z", "lent", 3000),
      entry("z", "received", 3000), // Zed settled
    ];
    const { owedToYou, youOwe, net, summaries } = summarizePeople(people, entries);
    expect(owedToYou).toBe(6000); // only Sarah is outstanding; Zed netted to 0
    expect(youOwe).toBe(5000); // Raza
    expect(net).toBe(1000); // 6000 − 5000
    // Outstanding people sort ahead of settled ones.
    expect(summaries[summaries.length - 1].person.id).toBe("z");
    expect(summaries.find((s) => s.person.id === "z")?.balance).toBe(0);
  });
});

describe("savings goals", () => {
  const goal = (id: string, target: number): SavingsGoal => ({
    id,
    name: id,
    target,
    note: "",
    color: "chart-1",
    icon: "PiggyBank",
    targetDate: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    deletedAt: null,
  });
  const contrib = (goalId: string, amount: number): SavingsContribution => ({
    id: Math.random().toString(36).slice(2),
    goalId,
    amount,
    note: "",
    date: "2024-06-10",
    createdAt: "2024-06-10T00:00:00Z",
    updatedAt: "2024-06-10T00:00:00Z",
    deletedAt: null,
  });

  it("sums contributions net of withdrawals", () => {
    expect(savedForGoal([contrib("g", 120000), contrib("g", 30000), contrib("g", -20000)])).toBe(130000);
  });

  it("floors overall progress at 0 when withdrawals exceed deposits", () => {
    const { overallPct } = summarizeGoals([goal("g", 1000)], [contrib("g", 200), contrib("g", -500)]);
    expect(overallPct).toBe(0);
  });

  it("computes progress and clamps percentage", () => {
    const { progress, totalSaved, totalTarget, overallPct } = summarizeGoals(
      [goal("g1", 500000), goal("g2", 100000)],
      [contrib("g1", 130000), contrib("g2", 100000)],
    );
    const g1 = progress.find((p) => p.goal.id === "g1")!;
    expect(g1.saved).toBe(130000);
    expect(g1.remaining).toBe(370000);
    expect(g1.pct).toBeCloseTo(26, 5);
    expect(g1.complete).toBe(false);
    const g2 = progress.find((p) => p.goal.id === "g2")!;
    expect(g2.complete).toBe(true);
    expect(g2.pct).toBe(100);
    expect(totalSaved).toBe(230000);
    expect(totalTarget).toBe(600000);
    expect(overallPct).toBeCloseTo((230000 / 600000) * 100, 5);
  });
});

describe("csv", () => {
  it("round-trips values containing commas, quotes and newlines", () => {
    const rows = [
      { date: "2024-06-01", note: "Lunch, with tax", amount: "12.50" },
      { date: "2024-06-02", note: 'Said "hi"\nthen left', amount: "0" },
    ];
    const csv = toCSV(rows, ["date", "note", "amount"]);
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].note).toBe("Lunch, with tax");
    expect(parsed[1].note).toBe('Said "hi"\nthen left');
    expect(parsed[1].amount).toBe("0");
  });
});
