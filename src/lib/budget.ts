import type { CategoryKind } from "@/db/schema";
import { daysInMonth } from "./dates";

export interface BudgetCategory {
  id: number;
  name: string;
  emoji: string;
  kind: CategoryKind;
}

export interface MonthTx {
  amountCents: number;
  categoryId: number | null;
  date: string;
}

export type PaceStatus = "ok" | "ahead" | "over" | "unbudgeted";

export interface CategoryLine {
  category: BudgetCategory;
  budgetCents: number;
  /** Positive number = money spent (refunds reduce it). For income, money received. */
  actualCents: number;
  remainingCents: number;
  /** actual / budget, may exceed 1. 0 when there's no budget. */
  progress: number;
  status: PaceStatus;
  txCount: number;
}

export interface MonthSummary {
  month: string;
  /** Fraction of the month elapsed (1 for past months, 0 for future ones). */
  timeFraction: number;
  daysLeft: number;
  income: { expectedCents: number; receivedCents: number; lines: CategoryLine[] };
  fixed: { budgetCents: number; spentCents: number; lines: CategoryLine[] };
  flexible: {
    budgetCents: number;
    spentCents: number;
    leftCents: number;
    /** What she can spend per remaining day to finish on budget. */
    perDayCents: number;
    /** Where spending "should" be by today if spread evenly. */
    expectedByNowCents: number;
    status: PaceStatus;
    lines: CategoryLine[];
  };
  uncategorized: { spentCents: number; txCount: number };
  /** Income plan minus every budget — money not yet given a job. */
  unplannedCents: number;
}

/** How far through `month` we are on `today` (both ISO strings). */
export function monthTiming(month: string, today: string) {
  const total = daysInMonth(month);
  const todayMonth = today.slice(0, 7);
  if (todayMonth > month) return { timeFraction: 1, daysLeft: 0, dayOfMonth: total, total };
  if (todayMonth < month) return { timeFraction: 0, daysLeft: total, dayOfMonth: 0, total };
  const day = Number(today.slice(8, 10));
  // Count today as a day you can still spend in.
  return { timeFraction: day / total, daysLeft: total - day + 1, dayOfMonth: day, total };
}

function paceStatus(budget: number, actual: number, timeFraction: number): PaceStatus {
  if (budget <= 0) return actual > 0 ? "unbudgeted" : "ok";
  if (actual > budget) return "over";
  // Give a little slack before warning — groceries are lumpy.
  if (timeFraction < 1 && actual > budget * timeFraction * 1.1 + 1000) return "ahead";
  return "ok";
}

export function summarizeMonth(
  month: string,
  today: string,
  categories: BudgetCategory[],
  budgets: Map<number, number>,
  txs: MonthTx[],
): MonthSummary {
  const { timeFraction, daysLeft } = monthTiming(month, today);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const sums = new Map<number, { total: number; count: number }>();
  let uncatSpent = 0;
  let uncatCount = 0;
  for (const tx of txs) {
    const cat = tx.categoryId != null ? byId.get(tx.categoryId) : undefined;
    if (!cat) {
      if (tx.amountCents < 0) {
        uncatSpent += -tx.amountCents;
        uncatCount++;
      }
      continue;
    }
    const s = sums.get(cat.id) ?? { total: 0, count: 0 };
    s.total += tx.amountCents;
    s.count++;
    sums.set(cat.id, s);
  }

  const line = (c: BudgetCategory): CategoryLine => {
    const s = sums.get(c.id) ?? { total: 0, count: 0 };
    const actual = c.kind === "income" ? s.total : 0 - s.total; // 0 - x avoids "-0 €"
    const budget = budgets.get(c.id) ?? 0;
    return {
      category: c,
      budgetCents: budget,
      actualCents: actual,
      remainingCents: budget - actual,
      progress: budget > 0 ? actual / budget : 0,
      status: c.kind === "flexible" ? paceStatus(budget, actual, timeFraction) : "ok",
      txCount: s.count,
    };
  };

  const pick = (kind: CategoryKind) => categories.filter((c) => c.kind === kind).map(line);
  const sum = (lines: CategoryLine[], f: (l: CategoryLine) => number) =>
    lines.reduce((acc, l) => acc + f(l), 0);

  const incomeLines = pick("income");
  const fixedLines = pick("fixed");
  const flexLines = pick("flexible");

  const flexBudget = sum(flexLines, (l) => l.budgetCents);
  // Uncategorised spending is counted as flexible so "left to spend" is never too optimistic.
  const flexSpent = sum(flexLines, (l) => l.actualCents) + uncatSpent;
  const flexLeft = flexBudget - flexSpent;
  const fixedBudget = sum(fixedLines, (l) => l.budgetCents);
  const incomeExpected = sum(incomeLines, (l) => l.budgetCents);

  return {
    month,
    timeFraction,
    daysLeft,
    income: {
      expectedCents: incomeExpected,
      receivedCents: sum(incomeLines, (l) => l.actualCents),
      lines: incomeLines,
    },
    fixed: {
      budgetCents: fixedBudget,
      spentCents: sum(fixedLines, (l) => l.actualCents),
      lines: fixedLines,
    },
    flexible: {
      budgetCents: flexBudget,
      spentCents: flexSpent,
      leftCents: flexLeft,
      perDayCents: daysLeft > 0 ? Math.max(0, Math.floor(flexLeft / daysLeft)) : 0,
      expectedByNowCents: Math.round(flexBudget * timeFraction),
      status: flexBudget > 0 ? paceStatus(flexBudget, flexSpent, timeFraction) : "unbudgeted",
      lines: flexLines,
    },
    uncategorized: { spentCents: uncatSpent, txCount: uncatCount },
    unplannedCents: incomeExpected - fixedBudget - flexBudget,
  };
}

/** Bill state for a fixed category: paid once roughly the planned amount has gone out. */
export function billState(line: CategoryLine): "paid" | "partly" | "due" | "none" {
  if (line.budgetCents <= 0) return line.actualCents > 0 ? "paid" : "none";
  if (line.actualCents >= line.budgetCents * 0.9) return "paid";
  if (line.actualCents > 0) return "partly";
  return "due";
}
