"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { connectBank, createAccount, deleteAccount, importFile, syncNow, type ActionResult } from "@/app/actions";
import type { Account } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { useToast } from "./toast";
import { btn, Card, cx, input } from "./ui";

function useResultToast(state: ActionResult | null, onOk?: () => void) {
  const toast = useToast();
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast(state.message ?? "Done");
      onOk?.();
    } else toast(state.error, "error");
  }, [state, toast, onOk]);
}

function timeAgo(iso: string | null, now: number) {
  if (!iso) return "never";
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function AccountCard({ account: a, now }: { account: Account; now: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const linked = a.provider === "enablebanking";
  const consentDays = a.consentExpiresAt ? Math.round((new Date(a.consentExpiresAt).getTime() - now) / 86400000) : null;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{a.name}</p>
          <p className="truncate text-[13px] text-ink-3">
            {[a.institution, a.ibanSuffix && `•••• ${a.ibanSuffix}`].filter(Boolean).join(" · ") || "Manual account"}
          </p>
        </div>
        <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", linked ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-2")}>
          {linked ? "Synced" : "Manual"}
        </span>
      </div>
      <p className="num mt-4 text-2xl font-bold">{a.balanceCents != null ? formatMoney(a.balanceCents) : "—"}</p>
      <div className="mt-1 text-[12px] text-ink-3">
        {linked ? <>Updated {timeAgo(a.lastSyncedAt, now)}</> : a.balanceAt ? <>Balance as of {a.balanceAt}</> : <>Balance from your last OFX import</>}
        {consentDays !== null && consentDays <= 14 && (
          <span className="text-warn"> · bank access expires in {Math.max(0, consentDays)} days — reconnect soon</span>
        )}
      </div>
      {a.lastSyncError && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-[12px] text-bad">{a.lastSyncError}</p>}
      <div className="mt-auto flex justify-end pt-3">
        <button
          type="button"
          className={cx(btn.ghost, "text-[13px]")}
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove “${a.name}” and all of its transactions?`)) return;
            start(async () => {
              const r = await deleteAccount(a.id);
              toast(r.ok ? (r.message ?? "Removed") : r.error, r.ok ? "ok" : "error");
            });
          }}
        >
          Remove
        </button>
      </div>
    </Card>
  );
}

export function SyncButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className={btn.secondary}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          toast(r.ok ? (r.message ?? "Synced") : r.error, r.ok ? "ok" : "error");
        })
      }
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={cx("size-4", pending && "animate-spin")} aria-hidden>
        <path fillRule="evenodd" d="M15.3 5.3A7 7 0 0 0 3.1 8.6a.75.75 0 1 0 1.46.35 5.5 5.5 0 0 1 9.6-2.6l-1.4.02a.75.75 0 0 0 .02 1.5l3.18-.04a.75.75 0 0 0 .74-.76l-.04-3.18a.75.75 0 0 0-1.5.02l.02 1.4ZM4.7 14.7a7 7 0 0 0 12.2-3.3.75.75 0 1 0-1.46-.35 5.5 5.5 0 0 1-9.6 2.6l1.4-.02a.75.75 0 0 0-.02-1.5l-3.18.04a.75.75 0 0 0-.74.76l.04 3.18a.75.75 0 0 0 1.5-.02l-.02-1.4Z" clipRule="evenodd" />
      </svg>
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}

export function ConnectBankForm({ banks }: { banks: { name: string; logo: string | null }[] }) {
  const [query, setQuery] = useState("CCF");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return banks.filter((b) => !q || b.name.toLowerCase().includes(q)).slice(0, 8);
  }, [banks, query]);

  return (
    <form
      action={(fd) => start(() => connectBank(fd))}
      className="space-y-3"
    >
      <input type="hidden" name="country" value="FR" />
      <input type="hidden" name="bank" value={selected ?? ""} />
      <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your bank" aria-label="Search your bank" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {matches.map((b) => (
          <li key={b.name}>
            <button
              type="button"
              onClick={() => setSelected(b.name)}
              className={cx(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition",
                selected === b.name ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
              )}
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">🏦</span>
              )}
              <span className="font-medium">{b.name}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="text-sm text-ink-3">No bank matches “{query}”.</li>}
      </ul>
      <button type="submit" className={btn.primary} disabled={!selected || pending}>
        {pending ? "Opening your bank…" : selected ? `Connect ${selected}` : "Choose your bank"}
      </button>
      <p className="text-[12px] text-ink-3">
        You&rsquo;ll approve access in your bank&rsquo;s app. Hearth can only read balances and transactions — it can never move money. Access
        lasts up to 180 days, then you&rsquo;ll be asked to reconnect.
      </p>
    </form>
  );
}

export function ImportForm({ accounts }: { accounts: { id: number; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await importFile(prev, fd);
    if (r.ok) {
      formRef.current?.reset();
      setFileName(null);
    }
    return r;
  }, null);
  useResultToast(state);

  if (!accounts.length) {
    return <p className="text-sm text-ink-3">Add an account first (below), then import its statements here.</p>;
  }
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Into account</span>
        <select name="accountId" className={input} defaultValue={accounts[0].id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-accent hover:bg-accent-soft/40">
        <span className="text-2xl" aria-hidden>📄</span>
        <span className="text-sm font-medium">{fileName ?? "Choose an OFX or CSV file"}</span>
        <span className="text-[12px] text-ink-3">In CCF online banking, use “Télécharger / Exporter les opérations” and pick OFX or CSV</span>
        <input
          type="file"
          name="file"
          accept=".ofx,.qfx,.csv,.txt,text/csv"
          className="sr-only"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <button type="submit" className={btn.primary} disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </button>
    </form>
  );
}

export function AddAccountForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createAccount, null);
  useResultToast(state);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Name</span>
        <input name="name" required placeholder="Joint account" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Bank</span>
        <input name="institution" placeholder="CCF" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Balance (€)</span>
        <input name="balance" inputMode="decimal" placeholder="optional" className={input} />
      </label>
      <button type="submit" className={btn.primary} disabled={pending}>
        Add
      </button>
    </form>
  );
}
