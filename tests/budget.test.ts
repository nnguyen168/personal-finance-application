import { describe, expect, it } from "vitest";
import { billState, monthTiming, summarizeMonth, type BudgetCategory } from "@/lib/budget";

const cats: BudgetCategory[] = [
  { id: 1, name: "Salary", emoji: "💼", kind: "income" },
  { id: 2, name: "Mortgage", emoji: "🏠", kind: "fixed" },
  { id: 3, name: "Groceries", emoji: "🛒", kind: "flexible" },
  { id: 4, name: "Clothes", emoji: "👗", kind: "flexible" },
  { id: 5, name: "Savings", emoji: "🔁", kind: "transfer" },
];
const budgets = new Map([
  [1, 400000],
  [2, 115000],
  [3, 60000],
  [4, 10000],
]);

describe("monthTiming", () => {
  it("counts today as a spendable day", () => {
    expect(monthTiming("2026-09", "2026-09-10")).toEqual({ timeFraction: 10 / 30, daysLeft: 21, dayOfMonth: 10, total: 30 });
  });
  it("handles past and future months", () => {
    expect(monthTiming("2026-08", "2026-09-10").timeFraction).toBe(1);
    expect(monthTiming("2026-10", "2026-09-10").timeFraction).toBe(0);
  });
});

describe("summarizeMonth", () => {
  const txs = [
    { amountCents: 400000, categoryId: 1, date: "2026-09-01" },
    { amountCents: -115000, categoryId: 2, date: "2026-09-05" },
    { amountCents: -25000, categoryId: 3, date: "2026-09-06" },
    { amountCents: 1000, categoryId: 3, date: "2026-09-07" }, // refund
    { amountCents: -12000, categoryId: 4, date: "2026-09-08" },
    { amountCents: -3000, categoryId: null, date: "2026-09-09" }, // not categorised yet
    { amountCents: -30000, categoryId: 5, date: "2026-09-09" }, // transfer: ignored
  ];
  const s = summarizeMonth("2026-09", "2026-09-10", cats, budgets, txs);

  it("computes what's left of everyday spending, including uncategorised spend", () => {
    expect(s.flexible.budgetCents).toBe(70000);
    expect(s.flexible.spentCents).toBe(24000 + 12000 + 3000);
    expect(s.flexible.leftCents).toBe(70000 - 39000);
    expect(s.flexible.perDayCents).toBe(Math.floor(31000 / 21));
  });

  it("flags categories by pace", () => {
    const groceries = s.flexible.lines.find((l) => l.category.id === 3)!;
    const clothes = s.flexible.lines.find((l) => l.category.id === 4)!;
    expect(groceries.actualCents).toBe(24000);
    expect(groceries.status).toBe("ahead"); // 240 € spent by day 10 of a 600 € budget
    expect(clothes.status).toBe("over");
  });

  it("tracks bills and income", () => {
    expect(billState(s.fixed.lines[0])).toBe("paid");
    expect(s.income.receivedCents).toBe(400000);
    expect(s.unplannedCents).toBe(400000 - 115000 - 70000);
  });
});
