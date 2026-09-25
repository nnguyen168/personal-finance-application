import { addMonths, currentMonth, formatMonth, formatMonthName, isValidMonth } from "@/lib/dates";
import { getBudgetSuggestions, getMonthSummary, getSpendingHistory } from "@/lib/queries";
import { BudgetSection, CopyBudgetButtons } from "@/components/budget-editor";
import { SpendingHistory } from "@/components/spending-history";
import { Card, cx, Money, MonthSwitcher, PageHeader } from "@/components/ui";

export const metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const sp = await searchParams;
  const requested = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const month = isValidMonth(requested) ? requested : currentMonth();

  const [summary, suggestions, history] = await Promise.all([
    getMonthSummary(month),
    getBudgetSuggestions(month),
    getSpendingHistory(month),
  ]);
  const hasPlan = [...summary.income.lines, ...summary.fixed.lines, ...summary.flexible.lines].some((l) => l.budgetCents > 0);
  const suggestionObj = Object.fromEntries(suggestions);

  const unplanned = summary.unplannedCents;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Budget"
        subtitle={`Plan ${formatMonthName(month)} once, then just check what's left.`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher
          month={month}
          label={formatMonth(month)}
          prevHref={`/budget?month=${addMonths(month, -1)}`}
          nextHref={`/budget?month=${addMonths(month, 1)}`}
        />
        <CopyBudgetButtons month={month} hasPlan={hasPlan} />
      </div>

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
        <Stat label="Expected income" cents={summary.income.expectedCents} />
        <Stat label="Fixed bills" cents={summary.fixed.budgetCents} dot="bg-fixed" />
        <Stat label="Everyday spending" cents={summary.flexible.budgetCents} dot="bg-accent" />
        <Stat
          label={unplanned >= 0 ? "Left to plan" : "Over-planned"}
          cents={Math.abs(unplanned)}
          tone={summary.income.expectedCents === 0 ? undefined : unplanned >= 0 ? "text-ok" : "text-bad"}
          hint={
            summary.income.expectedCents === 0
              ? "Add expected income"
              : unplanned > 0
                ? "Savings, or give it a job"
                : unplanned < 0
                  ? "Plan exceeds income"
                  : "Every euro has a job 🎯"
          }
        />
      </Card>

      <BudgetSection
        month={month}
        title="Income"
        description="What you expect to receive this month (salaries, benefits)."
        lines={summary.income.lines}
        suggestions={suggestionObj}
        kind="income"
      />
      <BudgetSection
        month={month}
        title="Fixed bills"
        description="Same every month and hard to change: mortgage, energy, internet, insurance…"
        lines={summary.fixed.lines}
        suggestions={suggestionObj}
        kind="fixed"
      />
      <BudgetSection
        month={month}
        title="Everyday spending"
        description="The part you control: food, clothes, going out. This is what “left to spend” tracks."
        lines={summary.flexible.lines}
        suggestions={suggestionObj}
        kind="flexible"
        timeFraction={summary.timeFraction}
      />

      <section>
        <h2 className="mb-3 px-1 text-[15px] font-semibold">Last 6 months</h2>
        <Card className="p-5">
          <SpendingHistory data={history} />
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, cents, tone, hint, dot }: { label: string; cents: number; tone?: string; hint?: string; dot?: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        {dot && <span className={cx("size-2 rounded-full", dot)} aria-hidden />}
        {label}
      </p>
      <Money cents={cents} decimals={false} className={cx("mt-1 block text-xl font-bold", tone)} />
      {hint && <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}
