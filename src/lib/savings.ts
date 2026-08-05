import { sumMoney } from "./format";
import type { SavingsContribution, SavingsGoal } from "./types";

export interface GoalProgress {
  goal: SavingsGoal;
  saved: number;
  target: number;
  remaining: number;
  pct: number;
  complete: boolean;
  contributionCount: number;
  lastActivity: string | null;
}

export function savedForGoal(contributions: SavingsContribution[]): number {
  return sumMoney(contributions.map((c) => c.amount));
}

export interface SavingsOverview {
  progress: GoalProgress[];
  totalSaved: number;
  totalTarget: number;
  overallPct: number;
}

export function summarizeGoals(
  goals: SavingsGoal[],
  contributions: SavingsContribution[],
): SavingsOverview {
  const byGoal = new Map<string, SavingsContribution[]>();
  for (const c of contributions) {
    const arr = byGoal.get(c.goalId) ?? [];
    arr.push(c);
    byGoal.set(c.goalId, arr);
  }

  const progress: GoalProgress[] = goals.map((goal) => {
    const list = byGoal.get(goal.id) ?? [];
    const saved = savedForGoal(list);
    const target = goal.target;
    const pct = target > 0 ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0;
    const lastActivity = list.reduce<string | null>(
      (max, c) => (max === null || c.date > max ? c.date : max),
      null,
    );
    return {
      goal,
      saved,
      target,
      remaining: sumMoney([target, -saved]),
      pct,
      complete: target > 0 && saved >= target,
      contributionCount: list.length,
      lastActivity,
    };
  });

  const totalSaved = sumMoney(progress.map((p) => p.saved));
  const totalTarget = sumMoney(progress.map((p) => p.target));
  return {
    progress,
    totalSaved,
    totalTarget,
    overallPct: totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0,
  };
}
