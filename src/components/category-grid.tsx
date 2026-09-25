"use client";

import type { Category, CategoryKind } from "@/db/schema";
import { KIND_LABELS } from "@/lib/kinds";
import { CategoryIcon } from "./category-icon";
import { cx } from "./cx";

export type CategoryOption = Pick<Category, "id" | "name" | "icon" | "kind">;

const ORDER: CategoryKind[] = ["flexible", "fixed", "income", "transfer"];

export function CategoryGrid({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: CategoryOption[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      {ORDER.map((kind) => {
        const items = categories.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind}>
            <p className="eyebrow mb-3">{KIND_LABELS[kind]}</p>
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
                      "flex flex-col items-center gap-2 rounded-2xl border px-1.5 pt-3 pb-2.5 text-center text-[12px] leading-tight transition duration-200 active:scale-[0.97] disabled:opacity-50",
                      selected ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                    )}
                  >
                    <CategoryIcon icon={c.icon} name={c.name} size="sm" className={selected ? "border-ink text-ink" : undefined} />
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
