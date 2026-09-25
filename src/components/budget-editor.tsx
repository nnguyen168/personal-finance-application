"use client";

import { useState, useTransition } from "react";
import { copyBudget, setBudget } from "@/app/actions";
import type { CategoryLine } from "@/lib/budget";
import type { BudgetSuggestion } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { Check } from "lucide-react";
import { CategoryIcon } from "./category-icon";
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
      <button type="button" className={cx(btn.secondary, "h-9 px-4 text-[13px]")} disabled={pending} onClick={() => run("last-plan")}>
        Copy last month
      </button>
      <button type="button" className={cx(btn.secondary, "h-9 px-4 text-[13px]")} disabled={pending} onClick={() => run("average")}>
        Use my averages
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
      <div className="mb-5 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-[28px] leading-tight">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num font-display text-[28px] leading-tight">{formatMoney(total, { decimals: false })}</p>
          <p className="num mt-1 text-[12px] text-ink-3">
            {formatMoney(actual, { decimals: false })} {kind === "income" ? "received" : "spent"}
          </p>
        </div>
      </div>
      <Card className="divide-y divide-line overflow-hidden">
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
    <div className="px-5 py-4">
      <div className="flex items-center gap-4">
        <CategoryIcon icon={line.category.icon} name={line.category.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px]">{line.category.name}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">
            {line.actualCents !== 0 && (
              <>
                {formatMoney(line.actualCents, { decimals: false })} {kind === "income" ? "in" : "spent"}
                {hint && " · "}
              </>
            )}
            {hint && (
              <button
                type="button"
                className="text-accent underline decoration-accent-mark/50 underline-offset-[3px] transition hover:decoration-accent"
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
        <label className="relative w-24 shrink-0 sm:w-28">
          <span className="sr-only">Budget for {line.category.name}</span>
          <input
            inputMode="decimal"
            value={value}
            placeholder="0"
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => save(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={cx(
              "num h-11 w-full border-0 border-b bg-transparent pr-6 pl-2 text-right text-[17px] outline-none transition duration-200 placeholder:text-ink-3/60 focus:border-ink",
              saved ? "border-ok" : "border-line",
            )}
          />
          <span className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-[13px] text-ink-3">
            {pending ? "…" : saved ? <Check className="size-3.5 text-ok" strokeWidth={2} /> : "€"}
          </span>
        </label>
      </div>
      {kind === "flexible" && line.budgetCents > 0 && (
        <div className="mt-3 pl-14">
          <ProgressBar value={line.progress} pace={timeFraction} status={line.status} size="sm" label={line.category.name} />
        </div>
      )}
    </div>
  );
}
