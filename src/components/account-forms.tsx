"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { connectBank, createAccount, deleteAccount, importFile, syncNow, type ActionResult } from "@/app/actions";
import type { Account } from "@/db/schema";
import { formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { FileUp, Landmark, RefreshCw } from "lucide-react";
import { useToast } from "./toast";
import { btn, cx, input } from "./ui";

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
    <div className="relative flex aspect-[1.7/1] flex-col overflow-hidden rounded-[24px] bg-ink p-6 text-bg">
      {/* A faint champagne arc gives the card some depth without decoration for its own sake. */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full border border-accent-mark/25" aria-hidden />
      <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full border border-accent-mark/15" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{a.name}</p>
          <p className="mt-0.5 truncate text-[12px] opacity-60">{a.institution || "Manual account"}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase opacity-70">
          <span className={cx("size-1.5 rounded-full", linked && !a.lastSyncError ? "bg-accent-mark" : "bg-bg/40")} aria-hidden />
          {linked ? "Synced" : "Manual"}
        </span>
      </div>
      <p className="num relative mt-auto font-display text-[40px] leading-none tracking-[-0.01em]">
        {a.balanceCents != null ? formatMoney(a.balanceCents) : "—"}
      </p>
      <div className="relative mt-3 flex items-end justify-between gap-3 text-[12px]">
        <span className="opacity-60">
          {a.ibanSuffix && <span className="num mr-2 tracking-[0.2em]">•••• {a.ibanSuffix}</span>}
          {linked ? <>Updated {timeAgo(a.lastSyncedAt, now)}</> : a.balanceAt ? <>As of {formatShortDate(a.balanceAt)}</> : null}
        </span>
        <button
          type="button"
          className="shrink-0 opacity-60 transition hover:opacity-100"
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
      {(a.lastSyncError || (consentDays !== null && consentDays <= 14)) && (
        <p className="relative mt-3 border-t border-bg/15 pt-3 text-[12px] opacity-80">
          {a.lastSyncError ?? `Bank access ends in ${Math.max(0, consentDays!)} days. Reconnect soon.`}
        </p>
      )}
    </div>
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
      <RefreshCw className={cx("size-4", pending && "animate-spin")} strokeWidth={1.5} aria-hidden />
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
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-[14px] transition duration-200",
                selected === b.name ? "border-ink" : "border-line hover:border-line-strong",
              )}
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full border border-line text-ink-2"><Landmark className="size-4" strokeWidth={1.4} /></span>
              )}
              <span>{b.name}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="text-[13px] text-ink-3">No bank matches “{query}”.</li>}
      </ul>
      <button type="submit" className={btn.primary} disabled={!selected || pending}>
        {pending ? "Opening your bank…" : selected ? `Connect ${selected}` : "Choose your bank"}
      </button>
      <p className="text-[12px] leading-relaxed text-ink-3">
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
    return <p className="text-[14px] text-ink-3">Add an account first (below), then import its statements here.</p>;
  }
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <label className="block">
        <span className="eyebrow mb-2 block">Into account</span>
        <select name="accountId" className={input} defaultValue={accounts[0].id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-line-strong px-4 py-10 text-center transition duration-200 hover:border-ink">
        <FileUp className="size-5 text-ink-2" strokeWidth={1.3} aria-hidden />
        <span className="text-[14px]">{fileName ?? "Choose an OFX or CSV file"}</span>
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
        <span className="eyebrow mb-2 block">Name</span>
        <input name="name" required placeholder="Joint account" className={input} />
      </label>
      <label className="block">
        <span className="eyebrow mb-2 block">Bank</span>
        <input name="institution" placeholder="CCF" className={input} />
      </label>
      <label className="block">
        <span className="eyebrow mb-2 block">Balance (€)</span>
        <input name="balance" inputMode="decimal" placeholder="optional" className={input} />
      </label>
      <button type="submit" className={btn.primary} disabled={pending}>
        Add
      </button>
    </form>
  );
}
