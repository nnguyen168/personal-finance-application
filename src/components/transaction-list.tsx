"use client";

import { useMemo, useState, useTransition } from "react";
import { categorizeTransaction, deleteTransaction } from "@/app/actions";
import { formatDayHeading, formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { TxRow } from "@/lib/queries";
import { CategoryGrid, type CategoryOption } from "./category-grid";
import { CategoryIcon } from "./category-icon";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { btn, Card, cx, input } from "./ui";

export function TransactionList({
  transactions,
  categories,
  compact = false,
  todayISO,
}: {
  transactions: TxRow[];
  categories: CategoryOption[];
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
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition duration-200 hover:bg-surface-2/50"
        >
          {cat ? (
            <CategoryIcon icon={cat.icon} name={cat.name} />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-[15px] text-ink-3" aria-hidden>
              ?
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15px]">
              <span className="truncate">{t.merchant}</span>
              {!t.reviewed && <span className="size-1.5 shrink-0 rounded-full bg-accent-mark" title="Needs review" />}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-3">
              {cat ? cat.name : <span className="text-warn">Choose a category</span>}
              {t.pending && " · pending"}
              {compact && ` · ${formatShortDate(t.date)}`}
              {t.note && ` · ${t.note}`}
            </p>
          </div>
          <span className={cx("num shrink-0 text-[15px]", income ? "text-ok" : "text-ink", t.pending && "opacity-55")}>
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
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.date}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h3 className="eyebrow">{formatDayHeading(g.date, todayISO)}</h3>
                <span className="num text-[12px] text-ink-3">{formatMoney(g.total, { signed: true })}</span>
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

function TransactionEditor({ tx, categories, onDone }: { tx: TxRow; categories: CategoryOption[]; onDone: () => void }) {
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
    <div className="space-y-7">
      <div className="text-center">
        <p className={cx("num font-display text-[52px] leading-none tracking-[-0.02em]", tx.amountCents > 0 && "text-ok")}>
          {formatMoney(tx.amountCents, { signed: tx.amountCents > 0, decimals: true })}
        </p>
        <p className="mt-3 text-[13px] text-ink-3">
          {formatShortDate(tx.date)} · {tx.accountName}
          {tx.pending && " · pending"}
        </p>
        <p className="mx-auto mt-2 max-w-sm font-mono text-[11px] tracking-tight break-words text-ink-3">{tx.description}</p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 border-y border-line py-4">
        <span className="text-[14px]">
          Always file <span className="font-medium">{tx.merchant}</span> this way
          <span className="mt-0.5 block text-[12px] text-ink-3">Applies to past and future transactions</span>
        </span>
        <Toggle checked={remember} onChange={setRemember} />
      </label>

      <CategoryGrid
        categories={categories}
        value={categoryId}
        onChange={(id) => {
          setCategoryId(id);
          // A single tap is enough when nothing else was edited — the usual case.
          if (merchant === tx.merchant && note === (tx.note ?? "")) save(id);
        }}
        disabled={pending}
      />

      <details className="group border-t border-line pt-5">
        <summary className="cursor-pointer text-[13px] text-ink-2 select-none marker:content-none">
          <span className="group-open:hidden">Rename or add a note</span>
          <span className="hidden group-open:inline">Details</span>
        </summary>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="eyebrow mb-2 block">Name</span>
            <input className={input} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Note</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A birthday present for Mum…" />
          </label>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={btn.danger}
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this transaction? It may return on the next bank sync.")) return;
            start(async () => {
              await deleteTransaction(tx.id);
              onDone();
            });
          }}
        >
          Delete
        </button>
        <button type="button" className={btn.primary} disabled={pending} onClick={() => save()}>
          {pending ? "Saving…" : tx.reviewed ? "Save" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-10 rounded-full bg-line-strong transition duration-200 peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-offset-2" aria-hidden />
      <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-sm transition duration-200 peer-checked:translate-x-4" aria-hidden />
    </span>
  );
}
