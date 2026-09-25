"use client";

import type { Category, CategoryKind } from "@/db/schema";
import { cx } from "./ui";

export const KIND_LABELS: Record<CategoryKind, string> = {
  flexible: "Everyday spending",
  fixed: "Fixed bills",
  income: "Income",
  transfer: "Not spending",
};

const ORDER: CategoryKind[] = ["flexible", "fixed", "income", "transfer"];

export function CategoryGrid({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: Pick<Category, "id" | "name" | "emoji" | "kind">[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {ORDER.map((kind) => {
        const items = categories.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind}>
            <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{KIND_LABELS[kind]}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((c) => {
                const selected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(c.id)}
                    aria-pressed={selected}
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-2.5 text-center text-[12px] leading-tight font-medium transition active:scale-95 disabled:opacity-60",
                      selected ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-surface-2",
                    )}
                  >
                    <span className="text-xl" aria-hidden>
                      {c.emoji}
                    </span>
                    <span className="line-clamp-2">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
