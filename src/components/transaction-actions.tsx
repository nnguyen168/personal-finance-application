"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addManualTransaction, markReviewed, type ActionResult } from "@/app/actions";
import type { Category } from "@/db/schema";
import { CategoryGrid } from "./category-grid";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { btn, cx, input } from "./ui";

export function MarkAllReviewed({ ids }: { ids: number[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      className="shrink-0 rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60"
      onClick={() =>
        start(async () => {
          const r = await markReviewed(ids);
          toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "ok" : "error");
        })
      }
    >
      {pending ? "…" : "Mark all as reviewed"}
    </button>
  );
}

export function AddTransactionButton({
  accounts,
  categories,
  today,
}: {
  accounts: { id: number; name: string }[];
  categories: Pick<Category, "id" | "name" | "emoji" | "kind">[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;
  return (
    <>
      <button type="button" className={btn.primary} onClick={() => setOpen(true)} aria-label="Add a transaction">
        <span className="text-lg leading-none">+</span>
        <span className="hidden sm:inline">Add</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add a transaction">
        {open && <AddForm accounts={accounts} categories={categories} today={today} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function AddForm({
  accounts,
  categories,
  today,
  onDone,
}: {
  accounts: { id: number; name: string }[];
  categories: Pick<Category, "id" | "name" | "emoji" | "kind">[];
  today: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addManualTransaction, null);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Saved");
      onDone();
    }
  }, [state, toast, onDone]);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-ink-2">For cash purchases or anything the bank doesn&rsquo;t show yet.</p>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={cx("h-9 rounded-full text-sm font-medium transition", direction === d ? "bg-surface shadow-card" : "text-ink-2")}
          >
            {d === "out" ? "Money out" : "Money in"}
          </button>
        ))}
      </div>
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Amount (€)</span>
        <input name="amount" inputMode="decimal" required autoFocus placeholder="0,00" className={cx(input, "num h-14 text-2xl font-semibold")} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">What was it?</span>
        <input name="merchant" required placeholder="e.g. Market vegetables" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[13px] text-ink-3">Date</span>
          <input name="date" type="date" defaultValue={today} required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-ink-3">Account</span>
          <select name="accountId" className={input} defaultValue={accounts[0].id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <p className="mb-2 text-[13px] text-ink-3">Category (optional)</p>
        <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />
      </div>
      {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}
      <button type="submit" className={cx(btn.primary, "w-full")} disabled={pending}>
        {pending ? "Saving…" : "Add transaction"}
      </button>
    </form>
  );
}
