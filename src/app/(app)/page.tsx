import Link from "next/link";
import { billState, monthTiming, type CategoryLine, type MonthSummary } from "@/lib/budget";
import { currentMonth, formatMonthName, formatShortDate, TIME_ZONE, todayISO } from "@/lib/dates";
import { getCategories, getMonthSummary, getReviewCount, hasBudget, listTransactions } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { TransactionList } from "@/components/transaction-list";
import { btn, Card, Chevron, cx, EmojiBadge, EmptyState, Money, Pill, ProgressBar, SectionHeader, tone } from "@/components/ui";

export default async function HomePage() {
  const month = currentMonth();
  const today = todayISO();
  const [summary, planned, reviewCount, recent, categories] = await Promise.all([
    getMonthSummary(month),
    hasBudget(month),
    getReviewCount(),
    listTransactions({ limit: 6 }),
    getCategories(),
  ]);
  const monthName = formatMonthName(month);
  const { dayOfMonth, total } = monthTiming(month, today);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-3">
            {monthName} · day {dayOfMonth} of {total}
          </p>
          <h1 className="mt-0.5 text-[28px] font-bold tracking-tight">{greeting()}</h1>
        </div>
        {reviewCount > 0 && (
          <Link href="/transactions?filter=review" className={cx(btn.secondary, "shrink-0")}>
            <span className="size-2 rounded-full bg-accent" aria-hidden />
            {reviewCount} to review
          </Link>
        )}
      </header>

      {planned ? <LeftToSpend summary={summary} monthName={monthName} /> : <PlanPrompt monthName={monthName} />}

      {planned && summary.flexible.lines.some((l) => l.budgetCents > 0 || l.actualCents > 0) && (
        <section>
          <SectionHeader
            title="Everyday spending"
            subtitle="The line on each bar shows where you'd be if spending evenly"
            action={<Link href="/budget" className={cx(btn.ghost, "shrink-0")}>Edit plan</Link>}
          />
          <Card className="divide-y divide-line">
            {summary.flexible.lines
              .filter((l) => l.budgetCents > 0 || l.actualCents > 0)
              .sort((a, b) => b.budgetCents - a.budgetCents || b.actualCents - a.actualCents)
              .map((l) => (
                <FlexRow key={l.category.id} line={l} month={month} pace={summary.timeFraction} />
              ))}
            {summary.uncategorized.txCount > 0 && (
              <Link href="/transactions?filter=uncategorized" className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/60">
                <EmojiBadge emoji="❔" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Not categorised yet</p>
                  <p className="text-[13px] text-ink-3">
                    {summary.uncategorized.txCount} {summary.uncategorized.txCount === 1 ? "transaction" : "transactions"} · counted as everyday spending
                  </p>
                </div>
                <Money cents={summary.uncategorized.spentCents} className="font-semibold" />
                <Chevron className="text-ink-3" />
              </Link>
            )}
          </Card>
        </section>
      )}

      {planned && <Bills summary={summary} />}

      <section>
        <SectionHeader
          title="Latest activity"
          action={<Link href="/transactions" className={btn.ghost}>See all</Link>}
        />
        {recent.length ? (
          <TransactionList transactions={recent} categories={categories} compact />
        ) : (
          <EmptyState
            emoji="🏦"
            title="No transactions yet"
            body="Connect your CCF account or import a statement to see where the money goes."
            action={<Link href="/accounts" className={btn.primary}>Add transactions</Link>}
          />
        )}
      </section>
    </div>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(new Date()));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function LeftToSpend({ summary, monthName }: { summary: MonthSummary; monthName: string }) {
  const f = summary.flexible;
  const over = f.leftCents < 0;
  const status = f.status;
  const statusText =
    status === "over"
      ? `Over by ${formatMoney(-f.leftCents)}`
      : status === "ahead"
        ? "Spending a little fast"
        : "On track";

  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">Left to spend in {monthName}</p>
        <Pill className={cx(tone(status).soft, tone(status).text)}>
          {status === "ok" ? "●" : status === "ahead" ? "▲" : "!"} {statusText}
        </Pill>
      </div>
      <p className={cx("num mt-2 text-5xl font-bold tracking-tight sm:text-6xl", over && "text-bad")}>
        {formatMoney(f.leftCents, { decimals: false })}
      </p>
      <p className="mt-2 text-[15px] text-ink-2">
        {over ? (
          <>Everyday spending is over plan — try to hold off on extras until next month.</>
        ) : summary.daysLeft > 0 ? (
          <>
            That&rsquo;s about <strong className="num font-semibold text-ink">{formatMoney(f.perDayCents, { decimals: false })} a day</strong> for the
            next {summary.daysLeft} {summary.daysLeft === 1 ? "day" : "days"}.
          </>
        ) : (
          <>Month complete.</>
        )}
      </p>

      <div className="mt-6">
        <ProgressBar value={f.budgetCents ? f.spentCents / f.budgetCents : 0} pace={summary.timeFraction} status={status} size="lg" label="Everyday spending" />
        <div className="mt-2 flex justify-between text-[13px] text-ink-3">
          <span>
            <Money cents={f.spentCents} decimals={false} /> spent
          </span>
          <span>
            of <Money cents={f.budgetCents} decimals={false} /> planned
          </span>
        </div>
      </div>
    </Card>
  );
}

function PlanPrompt({ monthName }: { monthName: string }) {
  return (
    <Card className="bg-accent p-6 text-accent-ink sm:p-7">
      <p className="text-sm font-medium opacity-80">New month, fresh start</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">Plan your {monthName} budget</h2>
      <p className="mt-2 max-w-md text-[15px] opacity-90">
        Takes two minutes: confirm the fixed bills, then decide how much goes to food, clothes and fun. We&rsquo;ll pre-fill it from what
        you usually spend.
      </p>
      <Link href="/budget" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold text-ink transition hover:brightness-95">
        Start planning <Chevron />
      </Link>
    </Card>
  );
}

function FlexRow({ line, month, pace }: { line: CategoryLine; month: string; pace: number }) {
  const t = tone(line.status);
  const unbudgeted = line.budgetCents === 0;
  return (
    <Link
      href={`/transactions?category=${line.category.id}&month=${month}`}
      className="flex items-center gap-3 px-4 py-3.5 transition first:rounded-t-3xl last:rounded-b-3xl hover:bg-surface-2/60"
    >
      <EmojiBadge emoji={line.category.emoji} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">{line.category.name}</p>
          <p className={cx("num shrink-0 text-[15px] font-semibold", line.remainingCents < 0 ? "text-bad" : "text-ink")}>
            {unbudgeted ? (
              <Money cents={line.actualCents} decimals={false} />
            ) : line.remainingCents >= 0 ? (
              <>{formatMoney(line.remainingCents, { decimals: false })} left</>
            ) : (
              <>{formatMoney(-line.remainingCents, { decimals: false })} over</>
            )}
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar value={unbudgeted ? 1 : line.progress} pace={unbudgeted ? undefined : pace} status={line.status} size="sm" label={line.category.name} />
        </div>
        <p className={cx("mt-1.5 text-[12px]", line.status === "ok" ? "text-ink-3" : t.text)}>
          {unbudgeted ? (
            "Spent without a plan"
          ) : (
            <>
              <Money cents={line.actualCents} decimals={false} /> of <Money cents={line.budgetCents} decimals={false} />
              {line.status === "ahead" && " · ahead of pace"}
            </>
          )}
        </p>
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
        subtitle={`${paidCount} of ${lines.length} paid · ${formatMoney(summary.fixed.spentCents, { decimals: false })} of ${formatMoney(summary.fixed.budgetCents, { decimals: false })}`}
      />
      <Card className="p-2">
        <ul className="grid gap-1 sm:grid-cols-2">
          {lines.map((l) => {
            const state = billState(l);
            return (
              <li key={l.category.id}>
                <Link
                  href={`/transactions?category=${l.category.id}&month=${summary.month}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-surface-2/60"
                >
                  <span
                    className={cx(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      state === "paid" ? "bg-fixed text-white" : "border-2 border-dashed border-line text-ink-3",
                    )}
                    aria-label={state === "paid" ? "Paid" : "Not paid yet"}
                  >
                    {state === "paid" ? "✓" : ""}
                  </span>
                  <span className="text-lg" aria-hidden>
                    {l.category.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{l.category.name}</span>
                  <span className={cx("num text-[15px]", state === "paid" ? "text-ink-2" : "font-semibold")}>
                    {formatMoney(state === "paid" ? l.actualCents : l.budgetCents, { decimals: false })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      {summary.income.expectedCents > 0 && (
        <p className="mt-3 px-1 text-[13px] text-ink-3">
          Income received: <Money cents={summary.income.receivedCents} decimals={false} className="font-medium text-ink-2" /> of{" "}
          <Money cents={summary.income.expectedCents} decimals={false} /> expected
          {summary.income.lines.some((l) => l.actualCents > 0) ? "" : ` · nothing yet this month (as of ${formatShortDate(todayISO())})`}
        </p>
      )}
    </section>
  );
}
