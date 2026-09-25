"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addManualTransaction, markReviewed, type ActionResult } from "@/app/actions";
import { Plus } from "lucide-react";
import { CategoryGrid, type CategoryOption } from "./category-grid";
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
      className={cx(btn.secondary, "shrink-0")}
      onClick={() =>
        start(async () => {
          const r = await markReviewed(ids);
          toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "ok" : "error");
        })
      }
    >
      {pending ? "…" : "Confirm all"}
    </button>
  );
}

export function AddTransactionButton({
  accounts,
  categories,
  today,
}: {
  accounts: { id: number; name: string }[];
  categories: CategoryOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;
  return (
    <>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink transition hover:border-ink"
        onClick={() => setOpen(true)}
        aria-label="Add a transaction"
      >
        <Plus className="size-[18px]" strokeWidth={1.5} />
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
  categories: CategoryOption[];
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
    <form action={action} className="space-y-6">
      <p className="text-[14px] text-ink-2">For cash, or anything the bank hasn&rsquo;t shown yet.</p>
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line p-1">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={cx("h-9 rounded-full text-[13px] transition duration-200", direction === d ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}
          >
            {d === "out" ? "Money out" : "Money in"}
          </button>
        ))}
      </div>
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <label className="block">
        <span className="eyebrow mb-2 block">Amount (€)</span>
        <input name="amount" inputMode="decimal" required autoFocus placeholder="0,00" className={cx(input, "num h-16 border-0 border-b bg-transparent px-0 text-center font-display text-[44px] rounded-none focus:border-ink")} />
      </label>
      <label className="block">
        <span className="eyebrow mb-2 block">Description</span>
        <input name="merchant" required placeholder="e.g. Market vegetables" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="eyebrow mb-2 block">Date</span>
          <input name="date" type="date" defaultValue={today} required className={input} />
        </label>
        <label className="block">
          <span className="eyebrow mb-2 block">Account</span>
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
        <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />
      </div>
      {state && !state.ok && <p className="text-[13px] text-bad">{state.error}</p>}
      <button type="submit" className={cx(btn.primary, "w-full")} disabled={pending}>
        {pending ? "Saving…" : "Add transaction"}
      </button>
    </form>
  );
}
