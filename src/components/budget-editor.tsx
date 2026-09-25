"use client";

import { useState, useTransition } from "react";
import { copyBudget, setBudget } from "@/app/actions";
import type { CategoryLine } from "@/lib/budget";
import type { BudgetSuggestion } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { useToast } from "./toast";
import { btn, Card, cx, ProgressBar } from "./ui";

export function CopyBudgetButtons({ month, hasPlan }: { month: string; hasPlan: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (source: "last-plan" | "average") => {
    if (hasPlan && !confirm("Replace the amounts already planned for this month?")) return;
    start(async () => {
      const r = await copyBudget(month, source);
      toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "ok" : "error");
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn.secondary} disabled={pending} onClick={() => run("last-plan")}>
        Copy last month
      </button>
      <button type="button" className={btn.secondary} disabled={pending} onClick={() => run("average")}>
        Use 3-month average
      </button>
    </div>
  );
}

export function BudgetSection({
  month,
  title,
  description,
  lines,
  suggestions,
  kind,
  timeFraction,
}: {
  month: string;
  title: string;
  description: string;
  lines: CategoryLine[];
  suggestions: Record<number, BudgetSuggestion>;
  kind: "income" | "fixed" | "flexible";
  timeFraction?: number;
}) {
  const total = lines.reduce((s, l) => s + l.budgetCents, 0);
  const actual = lines.reduce((s, l) => s + l.actualCents, 0);
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[15px] font-semibold">{formatMoney(total, { decimals: false })}</p>
          <p className="num text-[12px] text-ink-3">
            {formatMoney(actual, { decimals: false })} {kind === "income" ? "received" : "spent"}
          </p>
        </div>
      </div>
      <Card className="divide-y divide-line">
        {lines.map((l) => (
          <BudgetRow key={l.category.id} month={month} line={l} suggestion={suggestions[l.category.id]} kind={kind} timeFraction={timeFraction} />
        ))}
      </Card>
    </section>
  );
}

function centsToInput(c: number) {
  return c ? String(c / 100).replace(".", ",") : "";
}

function BudgetRow({
  month,
  line,
  suggestion,
  kind,
  timeFraction,
}: {
  month: string;
  line: CategoryLine;
  suggestion?: BudgetSuggestion;
  kind: "income" | "fixed" | "flexible";
  timeFraction?: number;
}) {
  const toast = useToast();
  const [value, setValue] = useState(centsToInput(line.budgetCents));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  // Keep in sync when the server data changes (e.g. after "copy last month").
  const [serverCents, setServerCents] = useState(line.budgetCents);
  if (serverCents !== line.budgetCents) {
    setServerCents(line.budgetCents);
    setValue(centsToInput(line.budgetCents));
  }

  const save = (v: string) => {
    if (v.trim() === centsToInput(line.budgetCents)) return;
    start(async () => {
      const r = await setBudget(month, line.category.id, v);
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1400);
      } else toast(r.error, "error");
    });
  };

  const hint = suggestion && (suggestion.avg3 > 0 || suggestion.lastActual > 0) ? suggestion : null;
  const quick = hint ? (hint.avg3 || hint.lastActual) : 0;

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-xl" aria-hidden>
          {line.category.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.category.name}</p>
          <p className="truncate text-[12px] text-ink-3">
            {line.actualCents !== 0 && (
              <>
                {formatMoney(line.actualCents, { decimals: false })} {kind === "income" ? "in" : "spent"}
                {hint && " · "}
              </>
            )}
            {hint && (
              <button
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
                onClick={() => {
                  const v = centsToInput(quick);
                  setValue(v);
                  save(v);
                }}
                title="Use this amount"
              >
                usually {formatMoney(quick, { decimals: false })}
              </button>
            )}
          </p>
        </div>
        <label className="relative w-28 shrink-0">
          <span className="sr-only">Budget for {line.category.name}</span>
          <input
            inputMode="decimal"
            value={value}
            placeholder="0"
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => save(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={cx(
              "num h-10 w-full rounded-xl border bg-surface-2 pr-7 pl-3 text-right text-[15px] font-semibold outline-none transition focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15",
              saved ? "border-ok" : "border-transparent",
            )}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">
            {pending ? "…" : saved ? "✓" : "€"}
          </span>
        </label>
      </div>
      {kind === "flexible" && line.budgetCents > 0 && (
        <div className="mt-3 pl-[52px]">
          <ProgressBar value={line.progress} pace={timeFraction} status={line.status} size="sm" label={line.category.name} />
        </div>
      )}
    </div>
  );
}
