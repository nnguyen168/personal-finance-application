import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { addMonths, formatMonth, isValidMonth, todayISO } from "@/lib/dates";
import { getAccounts, getCategories, getReviewCount, listTransactions, type TxFilter } from "@/lib/queries";
import { AddTransactionButton, MarkAllReviewed } from "@/components/transaction-actions";
import { TransactionList } from "@/components/transaction-list";
import { btn, cx, EmptyState, input, PageHeader } from "@/components/ui";

export const metadata = { title: "Activity" };

const FILTERS: { key: TxFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "To review" },
  { key: "uncategorized", label: "Uncategorised" },
  { key: "income", label: "Money in" },
];

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filter = (FILTERS.find((f) => f.key === one(sp.filter))?.key ?? "all") as TxFilter;
  const q = one(sp.q)?.trim() || undefined;
  const month = isValidMonth(one(sp.month)) ? one(sp.month) : undefined;
  const categoryId = Number(one(sp.category)) || undefined;

  const [txs, categories, reviewCount, accounts] = await Promise.all([
    listTransactions({ filter, q, month, categoryId }),
    getCategories(),
    getReviewCount(),
    getAccounts(),
  ]);
  const category = categories.find((c) => c.id === categoryId);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { filter, q, month, category: categoryId ? String(categoryId) : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "filter" && v === "all")) p.set(k, v);
    const s = p.toString();
    return s ? `/transactions?${s}` : "/transactions";
  };

  const total = txs.reduce((s, t) => s + t.amountCents, 0);

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={reviewCount > 0 ? `${reviewCount} new transactions to check` : "All caught up ✨"}
        action={<AddTransactionButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} categories={categories} today={todayISO()} />}
      />

      <form action="/transactions" className="mb-4 flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        {month && <input type="hidden" name="month" value={month} />}
        {categoryId && <input type="hidden" name="category" value={categoryId} />}
        <input name="q" defaultValue={q} placeholder="Search merchants, notes…" className={input} type="search" />
      </form>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ filter: f.key })}
            className={cx(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              filter === f.key ? "bg-ink text-bg" : "bg-surface text-ink-2 shadow-card hover:text-ink",
            )}
          >
            {f.label}
            {f.key === "review" && reviewCount > 0 && <span className="num ml-1.5 opacity-70">{reviewCount}</span>}
          </Link>
        ))}
      </div>

      {(category || month) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {category && (
            <Link href={href({ category: undefined })} className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
              {category.emoji} {category.name} ✕
            </Link>
          )}
          {month && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1 py-0.5 font-medium text-accent">
              <Link href={href({ month: addMonths(month, -1) })} className="rounded-full px-2 py-1" aria-label="Previous month">‹</Link>
              {formatMonth(month)}
              <Link href={href({ month: addMonths(month, 1) })} className="rounded-full px-2 py-1" aria-label="Next month">›</Link>
              <Link href={href({ month: undefined })} className="rounded-full px-2 py-1" aria-label="Any month">✕</Link>
            </span>
          )}
          <span className="num ml-auto text-ink-3">
            {txs.length} · net {formatMoney(total, { signed: true })}
          </span>
        </div>
      )}

      {filter === "review" && txs.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
          <span>Tap a transaction to fix its category. Happy with the rest?</span>
          <MarkAllReviewed ids={txs.map((t) => t.id)} />
        </div>
      )}

      {txs.length ? (
        <TransactionList transactions={txs} categories={categories} todayISO={todayISO()} />
      ) : (
        <EmptyState
          emoji={filter === "review" ? "🎉" : "🔍"}
          title={filter === "review" ? "Nothing to review" : "No transactions found"}
          body={
            filter === "review"
              ? "Every transaction has a category. Nice work."
              : accounts.length
                ? "Try a different search or filter."
                : "Connect your bank or import a statement to get started."
          }
          action={!accounts.length ? <Link href="/accounts" className={btn.primary}>Go to accounts</Link> : undefined}
        />
      )}
    </div>
  );
}
