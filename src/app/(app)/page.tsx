import { Check } from "lucide-react";
import Link from "next/link";
import { billState, type CategoryLine, type MonthSummary } from "@/lib/budget";
import { addDays, currentMonth, formatMonthName, TIME_ZONE, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCategories, getMonthSummary, getReviewCount, hasBudget, listTransactions } from "@/lib/queries";
import { CategoryIcon } from "@/components/category-icon";
import { TransactionList } from "@/components/transaction-list";
import { btn, Card, Chevron, cx, EmptyState, Money, ProgressBar, SectionHeader, StatusMark, tone } from "@/components/ui";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function HomePage() {
  const month = currentMonth();
  const today = todayISO();
  const [summary, planned, reviewCount, recent, categories] = await Promise.all([
    getMonthSummary(month),
    hasBudget(month),
    getReviewCount(),
    listTransactions({ limit: 5 }),
    getCategories(),
  ]);
  const monthName = formatMonthName(month);
  const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()];
  const flexLines = summary.flexible.lines
    .filter((l) => l.budgetCents > 0 || l.actualCents > 0)
    .sort((a, b) => b.budgetCents - a.budgetCents || b.actualCents - a.actualCents);

  return (
    <div className="space-y-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {weekday} · {Number(today.slice(8))} {monthName}
          </p>
          <h1 className="mt-2 font-display text-[40px] leading-none tracking-[-0.01em] sm:text-[48px]">{greeting()}</h1>
        </div>
        {reviewCount > 0 && (
          <Link
            href="/transactions?filter=review"
            className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[13px] text-ink-2 transition hover:border-ink hover:text-ink"
          >
            <span className="size-1.5 rounded-full bg-accent-mark" aria-hidden />
            <span className="num">{reviewCount}</span> to review
          </Link>
        )}
      </header>

      {planned ? <LeftToSpend summary={summary} monthName={monthName} /> : <PlanPrompt monthName={monthName} />}

      {planned && flexLines.length > 0 && (
        <section>
          <SectionHeader
            title="Everyday spending"
            action={<Link href="/budget" className={cx(btn.ghost, "-mr-3")}>Adjust plan <Chevron className="size-3.5" /></Link>}
          />
          <Card className="divide-y divide-line overflow-hidden">
            {flexLines.map((l) => (
              <FlexRow key={l.category.id} line={l} month={month} pace={summary.timeFraction} />
            ))}
            {summary.uncategorized.txCount > 0 && (
              <Link href="/transactions?filter=uncategorized" className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2/50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-[15px] text-ink-3" aria-hidden>
                  ?
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">Awaiting a category</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {summary.uncategorized.txCount} {summary.uncategorized.txCount === 1 ? "transaction" : "transactions"}, counted as everyday spending
                  </p>
                </div>
                <Money cents={summary.uncategorized.spentCents} decimals={false} className="text-[15px]" />
                <Chevron className="text-ink-3" />
              </Link>
            )}
          </Card>
          <p className="mt-3 flex items-center gap-2 px-1 text-[12px] text-ink-3">
            <span className="inline-block h-3 w-px bg-accent-mark" aria-hidden />
            marks where you&rsquo;d be today if spending evenly
          </p>
        </section>
      )}

      {planned && <Bills summary={summary} />}

      <section>
        <SectionHeader title="Latest activity" action={<Link href="/transactions" className={cx(btn.ghost, "-mr-3")}>View all <Chevron className="size-3.5" /></Link>} />
        {recent.length ? (
          <TransactionList transactions={recent} categories={categories} compact todayISO={today} />
        ) : (
          <EmptyState
            title="Nothing here yet"
            body="Connect your CCF account or import a statement, and your spending will appear here."
            action={<Link href="/accounts" className={btn.primary}>Add transactions</Link>}
          />
        )}
      </section>
    </div>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(new Date()));
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function LeftToSpend({ summary, monthName }: { summary: MonthSummary; monthName: string }) {
  const f = summary.flexible;
  const over = f.leftCents < 0;
  const [whole, currency] = splitCurrency(formatMoney(Math.abs(f.leftCents), { decimals: false }));

  return (
    <section aria-labelledby="left-to-spend">
      <div className="flex items-center justify-between gap-4">
        <p id="left-to-spend" className="eyebrow">
          {over ? `Over plan in ${monthName}` : `Left to spend in ${monthName}`}
        </p>
        {f.status !== "unbudgeted" && (
          <StatusMark status={f.status}>
            {f.status === "over" ? "Over plan" : f.status === "ahead" ? "A little ahead of pace" : "On track"}
          </StatusMark>
        )}
      </div>

      <p className={cx("num mt-4 flex items-baseline gap-2 font-display leading-[0.9] tracking-[-0.03em]", over && "text-bad")}>
        {over && <span className="text-[56px] sm:text-[72px]">−</span>}
        <span className="text-[88px] sm:text-[112px]">{whole}</span>
        <span className="text-[40px] text-ink-3 sm:text-[48px]">{currency}</span>
      </p>

      <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
        {over ? (
          <>Everyday spending has passed this month&rsquo;s plan. Best to hold extras until {nextMonthName(summary.month)}.</>
        ) : summary.daysLeft > 0 ? (
          <>
            About <span className="num text-ink">{formatMoney(f.perDayCents, { decimals: false })}</span> a day for the{" "}
            {summary.daysLeft === 1 ? "last day" : `remaining ${summary.daysLeft} days`}.
          </>
        ) : (
          <>The month is complete.</>
        )}
      </p>

      <div className="mt-10">
        <ProgressBar value={f.budgetCents ? f.spentCents / f.budgetCents : 0} pace={summary.timeFraction} status={f.status === "ok" ? "ok" : f.status} size="lg" label="Everyday spending" />
        <div className="mt-3 flex justify-between text-[12px] text-ink-3">
          <span>
            <Money cents={f.spentCents} decimals={false} className="text-ink-2" /> spent
          </span>
          <span>
            of <Money cents={f.budgetCents} decimals={false} className="text-ink-2" />
          </span>
        </div>
      </div>
    </section>
  );
}

/** "1 234 €" → ["1 234", "€"] so the currency can be set smaller. */
function splitCurrency(s: string): [string, string] {
  const m = s.match(/^(.*?)[\s ]*([^\d\s .,]+)$/);
  return m ? [m[1], m[2]] : [s, ""];
}

function nextMonthName(month: string) {
  return formatMonthName(addDays(`${month}-28`, 7).slice(0, 7));
}

function PlanPrompt({ monthName }: { monthName: string }) {
  return (
    <section className="rounded-[28px] bg-ink px-7 py-10 text-bg sm:px-10 sm:py-12">
      <p className="text-[11px] font-medium tracking-[0.14em] uppercase opacity-60">A new month</p>
      <h2 className="mt-3 font-display text-[44px] leading-[1.02]">
        Plan <span className="italic">{monthName}</span>.
      </h2>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed opacity-75">
        Two quiet minutes: confirm the fixed bills, then decide what goes to food, clothes and the rest. We&rsquo;ll suggest amounts from what
        you usually spend.
      </p>
      <Link href="/budget" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-bg px-6 text-[14px] font-medium text-ink transition hover:opacity-90">
        Begin <Chevron />
      </Link>
    </section>
  );
}

function FlexRow({ line, month, pace }: { line: CategoryLine; month: string; pace: number }) {
  const unbudgeted = line.budgetCents === 0;
  const over = line.remainingCents < 0;
  return (
    <Link href={`/transactions?category=${line.category.id}&month=${month}`} className="block px-5 py-4 transition hover:bg-surface-2/50">
      <div className="flex items-center gap-4">
        <CategoryIcon icon={line.category.icon} name={line.category.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px]">{line.category.name}</p>
            <p className={cx("num shrink-0 text-[15px]", over && "text-bad")}>
              {unbudgeted ? (
                <Money cents={line.actualCents} decimals={false} />
              ) : (
                <>
                  {formatMoney(Math.abs(line.remainingCents), { decimals: false })}
                  <span className={cx("ml-1 text-[12px]", over ? "text-bad" : "text-ink-3")}>{over ? "over" : "left"}</span>
                </>
              )}
            </p>
          </div>
          <div className="mt-3">
            <ProgressBar value={unbudgeted ? 1 : line.progress} pace={unbudgeted ? undefined : pace} status={line.status} size="sm" label={line.category.name} />
          </div>
          <p className={cx("mt-2 text-[12px]", line.status === "ok" ? "text-ink-3" : tone(line.status).text)}>
            {unbudgeted ? (
              "Not in this month's plan"
            ) : (
              <>
                <Money cents={line.actualCents} decimals={false} /> of <Money cents={line.budgetCents} decimals={false} />
                {line.status === "ahead" && " · ahead of pace"}
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Bills({ summary }: { summary: MonthSummary }) {
  const lines = summary.fixed.lines.filter((l) => l.budgetCents > 0 || l.actualCents > 0);
  if (!lines.length) return null;
  const paidCount = lines.filter((l) => billState(l) === "paid").length;
  return (
    <section>
      <SectionHeader
        title="Fixed bills"
        action={
          <span className="text-[12px] text-ink-3">
            {paidCount} of {lines.length} paid
          </span>
        }
      />
      <Card className="divide-y divide-line overflow-hidden">
        {lines.map((l) => {
          const paid = billState(l) === "paid";
          return (
            <Link
              key={l.category.id}
              href={`/transactions?category=${l.category.id}&month=${summary.month}`}
              className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2/50"
            >
              <CategoryIcon icon={l.category.icon} name={l.category.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{l.category.name}</span>
              <span className={cx("num text-[15px]", paid ? "text-ink-3" : "text-ink")}>
                {formatMoney(paid ? l.actualCents : l.budgetCents, { decimals: false })}
              </span>
              <span
                className={cx(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  paid ? "bg-ink text-bg" : "border border-line-strong",
                )}
                aria-label={paid ? "Paid" : "Not paid yet"}
              >
                {paid && <Check className="size-3" strokeWidth={2.5} />}
              </span>
            </Link>
          );
        })}
      </Card>
      <div className="mt-4 flex justify-between px-1 text-[12px] text-ink-3">
        <span>
          <Money cents={summary.fixed.spentCents} decimals={false} className="text-ink-2" /> of{" "}
          <Money cents={summary.fixed.budgetCents} decimals={false} /> paid out
        </span>
        {summary.income.expectedCents > 0 && (
          <span>
            Income <Money cents={summary.income.receivedCents} decimals={false} className="text-ink-2" /> of{" "}
            <Money cents={summary.income.expectedCents} decimals={false} />
          </span>
        )}
      </div>
    </section>
  );
}
