/**
 * Client-side execution of assistant tools. Runs against the local repositories
 * so the assistant stays local-first: Gemini returns a functionCall, and these
 * executors carry it out on the user's own IndexedDB data.
 *
 * Reads run immediately. Writes are split into prepare() → { summary, run } so
 * the UI can show a confirmation card before run() actually commits.
 */

import { transactionRepo, type TransactionInput } from "@/lib/repositories/transactions";
import { categoryRepo } from "@/lib/repositories/categories";
import { budgetRepo } from "@/lib/repositories/budgets";
import { assetRepo } from "@/lib/repositories/assets";
import { savingsGoalRepo, contributionRepo } from "@/lib/repositories/savings";
import { peopleRepo, debtRepo } from "@/lib/repositories/people";
import { budgetProgress, byCategory, monthlySeries, savingsRate, totals } from "@/lib/analytics";
import { summarizeAssets } from "@/lib/assets";
import { summarizePeople, debtKindLabel } from "@/lib/debts";
import { summarizeGoals } from "@/lib/savings";
import { presetRange, inRange, type PresetKey } from "@/lib/dates";
import { formatCurrency, roundMoney } from "@/lib/format";
import { CATEGORY_COLORS, ASSET_KIND_MAP } from "@/lib/constants";
import type { AssetKind, Category, CurrencyCode, DebtKind, PaymentMethod, TxType } from "@/lib/types";

export interface AssistantContext {
  today: string;
  currency: CurrencyCode;
  monthStartDay: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PreparedWrite {
  summary: string;
  run: () => Promise<Record<string, unknown>>;
}

const PERIOD_MAP: Record<string, PresetKey> = {
  this_month: "this-month",
  last_month: "last-month",
  this_year: "this-year",
  all: "all-time",
};

// --- small coercion + lookup helpers ---------------------------------------

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function matchCategory(cats: Category[], name: string, type: TxType): Category | undefined {
  const pool = cats.filter((c) => c.type === type && !c.archived);
  const q = name.trim().toLowerCase();
  return pool.find((c) => c.name.toLowerCase() === q) ?? pool.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
}

function fmt(amount: number, ctx: AssistantContext): string {
  return formatCurrency(amount, ctx.currency);
}

// --- reads ------------------------------------------------------------------

export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<Record<string, unknown>> {
  const period = (asStr(args.period) as string) ?? "this_month";
  const range = presetRange(PERIOD_MAP[period] ?? "this-month", new Date(), ctx.monthStartDay);

  if (name === "get_financial_summary") {
    const [allTx, cats, assets] = await Promise.all([
      transactionRepo.all(),
      categoryRepo.list(true),
      assetRepo.list(),
    ]);
    const txs = allTx.filter((t) => inRange(t.date, range));
    const t = totals(txs);
    const topExpenseCategories = byCategory(txs, cats, "expense")
      .slice(0, 5)
      .map((s) => ({ category: s.category?.name ?? "Uncategorized", total: s.total }));
    const allTime = totals(allTx);
    const assetSummary = summarizeAssets(assets);
    return {
      period,
      currency: ctx.currency,
      income: t.income,
      expense: t.expense,
      net: t.net,
      savingsRatePct: Math.round(savingsRate(t)),
      topExpenseCategories,
      ledgerNetAllTime: allTime.net,
      assets: {
        count: assets.length,
        totalCostBasis: assetSummary.totalCost,
        currentValue: assetSummary.totalWorth,
        gainLoss: assetSummary.totalGain,
      },
      note: "Amounts are in the user's currency. ledgerNetAllTime is income minus expenses over all time (a proxy for cash position). Net worth ≈ ledgerNetAllTime + assets.currentValue.",
    };
  }

  if (name === "list_transactions") {
    const [allTx, cats] = await Promise.all([transactionRepo.all(), categoryRepo.list(true)]);
    const type = asStr(args.type) as TxType | undefined;
    const catName = asStr(args.category);
    const limit = Math.min(50, Math.max(1, asNum(args.limit) ?? 10));
    const byId = new Map(cats.map((c) => [c.id, c.name] as const));
    let txs = allTx.filter((t) => inRange(t.date, range));
    if (type) txs = txs.filter((t) => t.type === type);
    if (catName) {
      const q = catName.toLowerCase();
      txs = txs.filter((t) => (byId.get(t.categoryId) ?? "").toLowerCase().includes(q));
    }
    const sort = asStr(args.sort);
    if (sort === "amount_high") txs.sort((a, b) => b.amount - a.amount);
    else if (sort === "amount_low") txs.sort((a, b) => a.amount - b.amount);
    else txs.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
    return {
      period,
      count: txs.length,
      transactions: txs.slice(0, limit).map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        category: byId.get(t.categoryId) ?? "Uncategorized",
        note: t.note,
        method: t.method,
      })),
    };
  }

  if (name === "get_budgets") {
    const [allTx, cats, budgets] = await Promise.all([
      transactionRepo.all(),
      categoryRepo.list(true),
      budgetRepo.list(),
    ]);
    // Budgets are always evaluated against the CURRENT budgeting month.
    const monthRange = presetRange("this-month", new Date(), ctx.monthStartDay);
    const monthTxs = allTx.filter((t) => inRange(t.date, monthRange));
    const progress = budgetProgress(budgets, monthTxs, cats);
    return {
      currency: ctx.currency,
      hasBudgets: budgets.length > 0,
      monthExpenseSoFar: totals(monthTxs).expense,
      budgets: progress.map((p) => ({
        name: p.label,
        limit: p.limit,
        spent: p.spent,
        remaining: p.remaining,
        pctUsed: Math.round(p.pct),
        status: p.status,
      })),
      note: budgets.length
        ? "remaining = limit − spent this month; status over/warning/under."
        : "No budgets set yet — offer to set one, e.g. 'set a 20000 food budget'.",
    };
  }

  if (name === "get_assets") {
    const assets = await assetRepo.list();
    const { valuations, totalCost, totalWorth, totalGain } = summarizeAssets(assets);
    return {
      currency: ctx.currency,
      totalCostBasis: totalCost,
      currentValue: totalWorth,
      gainLoss: totalGain,
      assets: valuations.map((v) => ({
        name: v.asset.name,
        kind: v.asset.kind,
        quantity: v.asset.quantity,
        unit: v.asset.unit,
        costBasis: v.costBasis,
        currentValue: v.worth,
        gainLoss: v.gain,
        gainPct: v.gainPct,
      })),
    };
  }

  if (name === "get_category_breakdown") {
    const [allTx, cats] = await Promise.all([transactionRepo.all(), categoryRepo.list(true)]);
    const type = (asStr(args.type) as TxType) === "income" ? "income" : "expense";
    const txs = allTx.filter((t) => inRange(t.date, range));
    const slices = byCategory(txs, cats, type);
    return {
      period,
      type,
      currency: ctx.currency,
      total: totals(txs)[type],
      categories: slices.map((s) => ({
        name: s.category?.name ?? "Uncategorized",
        total: s.total,
        pct: Math.round(s.pct),
      })),
    };
  }

  if (name === "get_spending_trend") {
    const allTx = await transactionRepo.all();
    const trendRange = presetRange("last-6-months", new Date(), ctx.monthStartDay);
    const txs = allTx.filter((t) => inRange(t.date, trendRange));
    return {
      currency: ctx.currency,
      note: "Last 6 months, oldest to newest.",
      months: monthlySeries(txs, trendRange).map((m) => ({
        month: m.label,
        income: m.income,
        expense: m.expense,
        net: m.net,
      })),
    };
  }

  if (name === "get_debts") {
    const [people, entries] = await Promise.all([peopleRepo.list(), debtRepo.all()]);
    const { summaries, owedToYou, youOwe, net } = summarizePeople(people, entries);
    return {
      currency: ctx.currency,
      owedToYou,
      youOwe,
      netOwedToYou: net,
      note: "balance > 0 means they owe you; balance < 0 means you owe them.",
      people: summaries
        .filter((s) => s.balance !== 0)
        .map((s) => ({ name: s.person.name, balance: s.balance })),
    };
  }

  if (name === "get_savings") {
    const [goals, contribs] = await Promise.all([savingsGoalRepo.list(), contributionRepo.all()]);
    const { progress, totalSaved, totalTarget, overallPct } = summarizeGoals(goals, contribs);
    return {
      currency: ctx.currency,
      totalSaved,
      totalTarget,
      overallPct: Math.round(overallPct),
      goals: progress.map((p) => ({
        name: p.goal.name,
        saved: p.saved,
        target: p.target,
        remaining: p.remaining,
        pct: Math.round(p.pct),
        complete: p.complete,
      })),
    };
  }

  if (name === "get_net_worth") {
    const [allTx, assets, people, entries] = await Promise.all([
      transactionRepo.all(),
      assetRepo.list(),
      peopleRepo.list(),
      debtRepo.all(),
    ]);
    const ledgerBalance = totals(allTx).net;
    const assetsValue = summarizeAssets(assets).totalWorth;
    const debts = summarizePeople(people, entries);
    return {
      currency: ctx.currency,
      netWorth: roundMoney(ledgerBalance + assetsValue + debts.net),
      breakdown: {
        ledgerBalance,
        assetsValue,
        owedToYou: debts.owedToYou,
        youOwe: debts.youOwe,
      },
      note: "netWorth = ledgerBalance (all-time income − expenses, a proxy for cash) + assetsValue + (owedToYou − youOwe). The app doesn't track bank balances directly.",
    };
  }

  return { error: `Unknown read tool: ${name}` };
}

// --- writes (prepared for confirmation) -------------------------------------

export async function prepareWriteTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  switch (name) {
    case "add_transaction":
      return prepareAddTransaction(args, ctx);
    case "edit_transaction":
      return prepareEditTransaction(args, ctx);
    case "delete_transaction":
      return prepareDeleteTransaction(args, ctx);
    case "add_asset":
      return prepareAddAsset(args, ctx);
    case "update_asset_value":
      return prepareUpdateAssetValue(args, ctx);
    case "set_budget":
      return prepareSetBudget(args, ctx);
    case "add_savings_contribution":
      return prepareAddSavings(args, ctx);
    case "add_savings_goal":
      return prepareAddSavingsGoal(args, ctx);
    case "add_debt":
      return prepareAddDebt(args, ctx);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function prepareAddTransaction(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const type = asStr(args.type) as TxType | undefined;
  const amount = asNum(args.amount);
  if (type !== "income" && type !== "expense") return { error: "type must be income or expense" };
  if (amount == null || amount <= 0) return { error: "A positive amount is required." };
  const date = asStr(args.date) && ISO.test(args.date as string) ? (args.date as string) : ctx.today;
  const method = (asStr(args.method) as string) ?? "cash";
  const catName = asStr(args.category);
  const note = asStr(args.note) ?? "";

  const cats = await categoryRepo.list(true);
  const existing = catName ? matchCategory(cats, catName, type) : undefined;
  const fallback = cats.find((c) => c.type === type && !c.archived);
  const displayCat = existing?.name ?? catName ?? fallback?.name ?? "Uncategorized";
  const isNew = Boolean(catName && !existing);

  const summary = `Add ${type} · ${fmt(amount, ctx)} · ${displayCat}${isNew ? " (new category)" : ""}${note ? ` · ${note}` : ""} · ${date}`;

  return {
    summary,
    run: async () => {
      let categoryId = existing?.id ?? fallback?.id;
      if (!categoryId) {
        const created = await categoryRepo.create({
          name: catName ?? "Uncategorized",
          type,
          color: CATEGORY_COLORS[0],
          icon: "ReceiptText",
        });
        categoryId = created.id;
      } else if (isNew && catName) {
        const created = await categoryRepo.create({
          name: catName,
          type,
          color: CATEGORY_COLORS[0],
          icon: "ReceiptText",
        });
        categoryId = created.id;
      }
      const tx = await transactionRepo.create({
        type,
        amount,
        categoryId,
        note,
        date,
        method: (["cash", "card", "bank", "wallet", "other"].includes(method) ? method : "cash") as never,
      });
      return { saved: true, id: tx.id, type, amount, category: displayCat, date };
    },
  };
}

async function prepareAddAsset(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const name = asStr(args.name);
  const kind = asStr(args.kind) as AssetKind | undefined;
  const purchaseAmount = asNum(args.purchaseAmount);
  if (!name) return { error: "An asset name is required." };
  if (!kind || !ASSET_KIND_MAP[kind]) return { error: "A valid kind is required." };
  if (purchaseAmount == null || purchaseAmount <= 0) return { error: "A purchase amount is required." };

  const quantity = asNum(args.quantity) ?? null;
  const unit = asStr(args.unit) ?? (quantity != null ? ASSET_KIND_MAP[kind].unit : "");
  const extraCost = asNum(args.extraCost) ?? 0;
  const purchaseDate = asStr(args.purchaseDate) && ISO.test(args.purchaseDate as string) ? (args.purchaseDate as string) : ctx.today;
  const unitPriced = quantity != null;
  const currentUnitPrice = unitPriced ? (asNum(args.currentUnitPrice) ?? null) : null;
  const currentValue = unitPriced ? null : (asNum(args.currentValue) ?? null);
  const meta = ASSET_KIND_MAP[kind];

  const summary = `Add asset · ${name}${quantity != null ? ` · ${quantity} ${unit}` : ""} · cost ${fmt(purchaseAmount + extraCost, ctx)}`;

  return {
    summary,
    run: async () => {
      const a = await assetRepo.create({
        name,
        kind,
        quantity,
        unit,
        purchaseDate,
        purchaseAmount,
        extraCost,
        currentUnitPrice,
        currentValue,
        color: meta.color,
        icon: meta.icon,
      });
      return { saved: true, id: a.id, name };
    },
  };
}

async function prepareUpdateAssetValue(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const name = asStr(args.name);
  if (!name) return { error: "Which asset? A name is required." };
  const assets = await assetRepo.list();
  const q = name.toLowerCase();
  const asset =
    assets.find((a) => a.name.toLowerCase() === q) ?? assets.find((a) => a.name.toLowerCase().includes(q));
  if (!asset) return { error: `No asset found matching "${name}".` };

  const unitPriced = asset.quantity != null;
  const rate = asNum(args.rate);
  const value = asNum(args.value);
  const figure = unitPriced ? rate : value;
  if (figure == null || figure <= 0) {
    return { error: unitPriced ? "A current rate per unit is required." : "A current value is required." };
  }

  const summary = unitPriced
    ? `Update ${asset.name} · rate ${fmt(figure, ctx)} per ${asset.unit || "unit"} → value ${fmt(figure * (asset.quantity ?? 0), ctx)}`
    : `Update ${asset.name} · current value ${fmt(figure, ctx)}`;

  return {
    summary,
    run: async () => {
      await assetRepo.update(asset.id, unitPriced ? { currentUnitPrice: figure } : { currentValue: figure });
      return { saved: true, name: asset.name };
    },
  };
}

async function prepareSetBudget(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const scope = asStr(args.scope);
  const amount = asNum(args.amount);
  if (scope !== "overall" && scope !== "category") return { error: "scope must be overall or category." };
  if (amount == null || amount <= 0) return { error: "A budget amount is required." };

  let categoryId: string | null = null;
  let label = "Overall";
  if (scope === "category") {
    const catName = asStr(args.category);
    if (!catName) return { error: "A category name is required for a category budget." };
    const cats = await categoryRepo.list(true);
    const cat = matchCategory(cats, catName, "expense");
    if (!cat) return { error: `No expense category found matching "${catName}".` };
    categoryId = cat.id;
    label = cat.name;
  }

  const summary = `Set budget · ${label} · ${fmt(amount, ctx)} / month`;
  return {
    summary,
    run: async () => {
      await budgetRepo.upsert({ scope: scope as never, categoryId, amount });
      return { saved: true, scope, category: label, amount };
    },
  };
}

async function prepareAddSavings(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const goalName = asStr(args.goal);
  const amount = asNum(args.amount);
  if (!goalName) return { error: "Which savings goal?" };
  if (amount == null || amount === 0) return { error: "An amount is required." };
  const goals = await savingsGoalRepo.list();
  const q = goalName.toLowerCase();
  const goal =
    goals.find((g) => g.name.toLowerCase() === q) ?? goals.find((g) => g.name.toLowerCase().includes(q));
  if (!goal) return { error: `No savings goal found matching "${goalName}".` };
  const date = asStr(args.date) && ISO.test(args.date as string) ? (args.date as string) : ctx.today;

  const summary = `${amount >= 0 ? "Add" : "Withdraw"} ${fmt(Math.abs(amount), ctx)} ${amount >= 0 ? "to" : "from"} "${goal.name}" · ${date}`;
  return {
    summary,
    run: async () => {
      await contributionRepo.create({ goalId: goal.id, amount, note: "", date });
      return { saved: true, goal: goal.name, amount };
    },
  };
}

const METHODS = ["cash", "card", "bank", "wallet", "other"];

async function prepareEditTransaction(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const id = asStr(args.id);
  if (!id) return { error: "Which transaction? Call list_transactions first to get its id." };
  const tx = await transactionRepo.get(id);
  if (!tx || tx.deletedAt) return { error: "That transaction wasn't found." };

  const patch: Partial<TransactionInput> = {};
  const changes: string[] = [];

  const amount = asNum(args.amount);
  if (amount != null) {
    if (amount <= 0) return { error: "Amount must be greater than zero." };
    patch.amount = amount;
    changes.push(`amount → ${fmt(amount, ctx)}`);
  }
  if (args.note !== undefined) {
    patch.note = asStr(args.note) ?? "";
    changes.push(`note → "${patch.note}"`);
  }
  const date = asStr(args.date);
  if (date) {
    if (!ISO.test(date)) return { error: "Invalid date." };
    patch.date = date;
    changes.push(`date → ${date}`);
  }
  const method = asStr(args.method);
  if (method) {
    if (!METHODS.includes(method)) return { error: "Invalid payment method." };
    patch.method = method as PaymentMethod;
    changes.push(`method → ${method}`);
  }

  const catName = asStr(args.category);
  let resolvedCat: { id?: string; create?: boolean } | null = null;
  if (catName) {
    const cats = await categoryRepo.list(true);
    const match = matchCategory(cats, catName, tx.type);
    resolvedCat = match ? { id: match.id } : { create: true };
    changes.push(`category → ${catName}${match ? "" : " (new)"}`);
  }

  if (changes.length === 0) return { error: "Tell me what to change (amount, note, category, date, or method)." };

  const summary = `Update transaction (${fmt(tx.amount, ctx)} on ${tx.date}): ${changes.join(", ")}`;
  return {
    summary,
    run: async () => {
      if (catName && resolvedCat) {
        if (resolvedCat.id) {
          patch.categoryId = resolvedCat.id;
        } else {
          const created = await categoryRepo.create({
            name: catName,
            type: tx.type,
            color: CATEGORY_COLORS[0],
            icon: "ReceiptText",
          });
          patch.categoryId = created.id;
        }
      }
      await transactionRepo.update(id, patch);
      return { saved: true, id };
    },
  };
}

async function prepareDeleteTransaction(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const id = asStr(args.id);
  if (!id) return { error: "Which transaction? Call list_transactions first to get its id." };
  const tx = await transactionRepo.get(id);
  if (!tx || tx.deletedAt) return { error: "That transaction wasn't found." };
  const cats = await categoryRepo.list(true);
  const catName = cats.find((c) => c.id === tx.categoryId)?.name ?? "Uncategorized";
  const summary = `Delete ${tx.type} · ${fmt(tx.amount, ctx)} · ${catName}${tx.note ? ` · ${tx.note}` : ""} · ${tx.date}`;
  return {
    summary,
    run: async () => {
      await transactionRepo.remove(id);
      return { deleted: true, id };
    },
  };
}

async function prepareAddSavingsGoal(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const name = asStr(args.name);
  const target = asNum(args.target);
  if (!name) return { error: "A goal name is required." };
  if (target == null || target <= 0) return { error: "A target amount is required." };
  const targetDate = asStr(args.targetDate) && ISO.test(args.targetDate as string) ? (args.targetDate as string) : null;
  const summary = `Create savings goal · ${name} · target ${fmt(target, ctx)}${targetDate ? ` by ${targetDate}` : ""}`;
  return {
    summary,
    run: async () => {
      const g = await savingsGoalRepo.create({
        name,
        target,
        note: "",
        color: CATEGORY_COLORS[0],
        icon: "PiggyBank",
        targetDate,
      });
      return { saved: true, id: g.id, name };
    },
  };
}

async function prepareAddDebt(
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<PreparedWrite | { error: string }> {
  const personName = asStr(args.person);
  const kind = asStr(args.kind) as DebtKind | undefined;
  const amount = asNum(args.amount);
  if (!personName) return { error: "Whose debt? A person's name is required." };
  if (!kind || !["lent", "borrowed", "repaid", "received"].includes(kind)) {
    return { error: "kind must be lent, borrowed, repaid, or received." };
  }
  if (amount == null || amount <= 0) return { error: "An amount is required." };
  const date = asStr(args.date) && ISO.test(args.date as string) ? (args.date as string) : ctx.today;

  const people = await peopleRepo.list();
  const q = personName.toLowerCase();
  const existing =
    people.find((p) => p.name.toLowerCase() === q) ?? people.find((p) => p.name.toLowerCase().includes(q));

  const summary = `${debtKindLabel(kind)} ${fmt(amount, ctx)} · ${existing ? existing.name : `${personName} (new)`} · ${date}`;
  return {
    summary,
    run: async () => {
      let personId = existing?.id;
      if (!personId) {
        const p = await peopleRepo.create({ name: personName });
        personId = p.id;
      }
      await debtRepo.create({ personId, kind, amount, note: "", date });
      return { saved: true, person: existing ? existing.name : personName, kind, amount };
    },
  };
}
