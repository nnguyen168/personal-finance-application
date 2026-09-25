import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { addMonths, formatMonth, isValidMonth, todayISO } from "@/lib/dates";
import { getAccounts, getCategories, getReviewCount, listTransactions, type TxFilter } from "@/lib/queries";
import { AddTransactionButton, MarkAllReviewed } from "@/components/transaction-actions";
import { TransactionList } from "@/components/transaction-list";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
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
        eyebrow={reviewCount > 0 ? `${reviewCount} awaiting review` : "All reviewed"}
        action={<AddTransactionButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} categories={categories} today={todayISO()} />}
      />

      <form action="/transactions" className="relative mb-5">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        {month && <input type="hidden" name="month" value={month} />}
        {categoryId && <input type="hidden" name="category" value={categoryId} />}
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} aria-hidden />
        <input name="q" defaultValue={q} placeholder="Search merchants and notes" className={cx(input, "pl-11")} type="search" aria-label="Search" />
      </form>

      <div className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ filter: f.key })}
            className={cx(
              "shrink-0 rounded-full border px-4 py-2 text-[13px] transition duration-200",
              filter === f.key ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {f.label}
            {f.key === "review" && reviewCount > 0 && <span className="num ml-1.5 opacity-60">{reviewCount}</span>}
          </Link>
        ))}
      </div>

      {(category || month) && (
        <div className="mb-8 flex flex-wrap items-center gap-2 text-[13px]">
          {category && (
            <Link href={href({ category: undefined })} className="inline-flex items-center gap-2 rounded-full border border-line py-1.5 pr-3 pl-1.5 text-ink transition hover:border-ink">
              <CategoryIcon icon={category.icon} name={category.name} size="sm" className="size-6" />
              {category.name}
              <X className="size-3.5 text-ink-3" strokeWidth={1.5} aria-label="Clear category" />
            </Link>
          )}
          {month && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-1 py-0.5 text-ink">
              <Link href={href({ month: addMonths(month, -1) })} className="rounded-full p-1.5 text-ink-3 hover:text-ink" aria-label="Previous month">
                <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              </Link>
              {formatMonth(month)}
              <Link href={href({ month: addMonths(month, 1) })} className="rounded-full p-1.5 text-ink-3 hover:text-ink" aria-label="Next month">
                <ChevronRight className="size-3.5" strokeWidth={1.5} />
              </Link>
              <Link href={href({ month: undefined })} className="rounded-full p-1.5 text-ink-3 hover:text-ink" aria-label="Any month">
                <X className="size-3.5" strokeWidth={1.5} />
              </Link>
            </span>
          )}
          <span className="num ml-auto text-ink-3">
            {txs.length} · net {formatMoney(total, { signed: true })}
          </span>
        </div>
      )}

      {filter === "review" && txs.length > 0 && (
        <div className="mb-8 flex items-center justify-between gap-4 border-y border-line py-4">
          <p className="text-[13px] leading-relaxed text-ink-2">Tap one to change its category, or confirm them all.</p>
          <MarkAllReviewed ids={txs.map((t) => t.id)} />
        </div>
      )}

      {txs.length ? (
        <TransactionList transactions={txs} categories={categories} todayISO={todayISO()} />
      ) : (
        <EmptyState
          title={filter === "review" ? "All reviewed" : "Nothing found"}
          body={
            filter === "review"
              ? "Every transaction has its place. Nicely done."
              : accounts.length
                ? "Try another search or filter."
                : "Connect your bank or import a statement to begin."
          }
          action={!accounts.length ? <Link href="/accounts" className={btn.primary}>Go to accounts</Link> : undefined}
        />
      )}
    </div>
  );
}
