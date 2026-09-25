import { addMonths, currentMonth, formatMonth, formatMonthName, isValidMonth } from "@/lib/dates";
import { getBudgetSuggestions, getMonthSummary, getSpendingHistory } from "@/lib/queries";
import { BudgetSection, CopyBudgetButtons } from "@/components/budget-editor";
import { SpendingHistory } from "@/components/spending-history";
import { Card, cx, Money, MonthSwitcher, PageHeader, SectionHeader } from "@/components/ui";

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
  const noIncome = summary.income.expectedCents === 0;

  return (
    <div className="space-y-16">
      <div>
        <PageHeader title="Budget" subtitle={`Set ${formatMonthName(month)} once, then simply watch what remains.`} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MonthSwitcher
            label={formatMonth(month)}
            prevHref={`/budget?month=${addMonths(month, -1)}`}
            nextHref={`/budget?month=${addMonths(month, 1)}`}
          />
          <CopyBudgetButtons month={month} hasPlan={hasPlan} />
        </div>
      </div>

      {/* The plan as a simple equation: income − bills − everyday = unplanned */}
      <Card className="px-6 py-7 sm:px-8">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
          <Term label="Income" cents={summary.income.expectedCents} />
          <Term label="Fixed bills" cents={summary.fixed.budgetCents} op="−" swatch="bg-chart-fixed" />
          <Term label="Everyday" cents={summary.flexible.budgetCents} op="−" swatch="bg-chart-flex" />
          <Term
            label={unplanned >= 0 ? "Unplanned" : "Over-planned"}
            cents={Math.abs(unplanned)}
            op="="
            tone={noIncome ? undefined : unplanned < 0 ? "text-bad" : undefined}
          />
        </dl>
        <p className="mt-6 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-3">
          {noIncome
            ? "Add your expected income below to see how the plan fits."
            : unplanned > 0
              ? "Money with no job yet: leave it for savings, or give it to a category."
              : unplanned < 0
                ? "The plan asks for more than you expect to earn. Trim a category or two."
                : "Every euro has a purpose this month."}
        </p>
      </Card>

      <BudgetSection
        month={month}
        title="Income"
        description="What you expect to receive: salaries, benefits."
        lines={summary.income.lines}
        suggestions={suggestionObj}
        kind="income"
      />
      <BudgetSection
        month={month}
        title="Fixed bills"
        description="The same each month and hard to change."
        lines={summary.fixed.lines}
        suggestions={suggestionObj}
        kind="fixed"
      />
      <BudgetSection
        month={month}
        title="Everyday"
        description="The part you control. This is what “left to spend” follows."
        lines={summary.flexible.lines}
        suggestions={suggestionObj}
        kind="flexible"
        timeFraction={summary.timeFraction}
      />

      <section>
        <SectionHeader title="The last six months" />
        <Card className="px-6 py-7 sm:px-8">
          <SpendingHistory data={history} />
        </Card>
      </section>
    </div>
  );
}

function Term({ label, cents, op, tone, swatch }: { label: string; cents: number; op?: string; tone?: string; swatch?: string }) {
  return (
    <div className="relative">
      <dt className="eyebrow flex items-center gap-2">
        {op && <span className="font-sans text-[13px] tracking-normal text-ink-3">{op}</span>}
        {swatch && <span className={cx("size-1.5 rounded-full", swatch)} aria-hidden />}
        {label}
      </dt>
      <dd className="mt-2">
        <Money cents={cents} decimals={false} className={cx("font-display text-[30px] leading-none tracking-[-0.01em]", tone)} />
      </dd>
    </div>
  );
}
