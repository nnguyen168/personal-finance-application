"use client";

import { useMemo, useState, useTransition } from "react";
import { categorizeTransaction, deleteTransaction } from "@/app/actions";
import type { Category } from "@/db/schema";
import { formatDayHeading, formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { TxRow } from "@/lib/queries";
import { CategoryGrid } from "./category-grid";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { btn, Card, cx, EmojiBadge, input } from "./ui";

export function TransactionList({
  transactions,
  categories,
  compact = false,
  todayISO,
}: {
  transactions: TxRow[];
  categories: Pick<Category, "id" | "name" | "emoji" | "kind">[];
  compact?: boolean;
  todayISO?: string;
}) {
  const [editing, setEditing] = useState<TxRow | null>(null);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const groups = useMemo(() => {
    const out: { date: string; items: TxRow[]; total: number }[] = [];
    for (const t of transactions) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) {
        last.items.push(t);
        last.total += t.amountCents;
      } else out.push({ date: t.date, items: [t], total: t.amountCents });
    }
    return out;
  }, [transactions]);

  const row = (t: TxRow) => {
    const cat = t.categoryId != null ? byId.get(t.categoryId) : undefined;
    const income = t.amountCents > 0;
    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => setEditing(t)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60"
        >
          <EmojiBadge emoji={cat?.emoji ?? "❔"} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-medium">
              <span className="truncate">{t.merchant}</span>
              {!t.reviewed && <span className="size-2 shrink-0 rounded-full bg-accent" title="Needs review" />}
            </p>
            <p className="truncate text-[13px] text-ink-3">
              {cat ? cat.name : <span className="font-medium text-warn">Choose a category</span>}
              {t.pending && " · pending"}
              {compact && ` · ${formatShortDate(t.date)}`}
              {t.note && ` · ${t.note}`}
            </p>
          </div>
          <span className={cx("num shrink-0 text-[15px] font-semibold", income ? "text-ok" : "text-ink", t.pending && "opacity-60")}>
            {formatMoney(t.amountCents, { signed: income, decimals: true })}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      {compact ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">{transactions.map(row)}</ul>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.date}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{formatDayHeading(g.date, todayISO)}</h3>
                <span className="num text-[13px] text-ink-3">{formatMoney(g.total, { signed: true })}</span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{g.items.map(row)}</ul>
              </Card>
            </section>
          ))}
        </div>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.merchant ?? ""}>
        {editing && <TransactionEditor key={editing.id} tx={editing} categories={categories} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function TransactionEditor({
  tx,
  categories,
  onDone,
}: {
  tx: TxRow;
  categories: Pick<Category, "id" | "name" | "emoji" | "kind">[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [categoryId, setCategoryId] = useState<number | null>(tx.categoryId);
  const [merchant, setMerchant] = useState(tx.merchant);
  const [note, setNote] = useState(tx.note ?? "");
  const [remember, setRemember] = useState(true);

  const save = (catId: number | null = categoryId) =>
    start(async () => {
      const r = await categorizeTransaction({ id: tx.id, categoryId: catId, merchant, note, remember: remember && catId !== null });
      if (r.ok) {
        if (r.message) toast(r.message);
        onDone();
      } else toast(r.error, "error");
    });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <p className={cx("num text-2xl font-bold", tx.amountCents > 0 && "text-ok")}>
          {formatMoney(tx.amountCents, { signed: tx.amountCents > 0, decimals: true })}
        </p>
        <p className="mt-1 text-[13px] break-words text-ink-3">
          {formatShortDate(tx.date)} · {tx.accountName}
          {tx.pending && " · pending"}
        </p>
        <p className="mt-1 font-mono text-[12px] break-words text-ink-3">{tx.description}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-2">Category</p>
        <CategoryGrid
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            // One tap is enough when nothing else was changed — the common case.
            if (merchant === tx.merchant && note === (tx.note ?? "")) save(id);
          }}
          disabled={pending}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-4 py-3">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-0.5 size-5 accent-[var(--accent)]"
        />
        <span className="text-sm">
          <span className="font-medium">Always use this for “{tx.merchant}”</span>
          <span className="block text-ink-3">Applies to past and future transactions from this merchant.</span>
        </span>
      </label>

      <details className="group rounded-2xl border border-line px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-2 select-none">Rename or add a note</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[13px] text-ink-3">Name</span>
            <input className={input} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-ink-3">Note</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Birthday present for Mum" />
          </label>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          className={btn.danger}
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this transaction? It may come back on the next bank sync.")) return;
            start(async () => {
              await deleteTransaction(tx.id);
              onDone();
            });
          }}
        >
          Delete
        </button>
        <button type="button" className={btn.primary} disabled={pending} onClick={() => save()}>
          {pending ? "Saving…" : tx.reviewed ? "Save" : "Looks good"}
        </button>
      </div>
    </div>
  );
}
