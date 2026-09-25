"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { archiveCategory, deleteRule, recategorizeUnreviewed, saveCategory, type ActionResult } from "@/app/actions";
import type { Category, CategoryKind } from "@/db/schema";
import { KIND_LABELS } from "@/lib/kinds";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { ChevronRight, Plus } from "lucide-react";
import { CATEGORY_ICONS, CategoryIcon, ICON_CHOICES } from "./category-icon";
import { btn, cx, input } from "./ui";


export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink transition hover:border-ink"
        onClick={() => setOpen(true)}
        aria-label="New category"
      >
        <Plus className="size-[18px]" strokeWidth={1.5} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="New category">
        {open && <CategoryForm onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

export function CategoryRow({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition duration-200 hover:bg-surface-2/50">
        <CategoryIcon icon={category.icon} name={category.name} />
        <span className="flex-1 text-[15px]">{category.name}</span>
        <ChevronRight className="size-4 text-ink-3" strokeWidth={1.5} aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Edit ${category.name}`}>
        {open && <CategoryForm category={category} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCategory, null);
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "flexible");
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Saved");
      onDone();
    }
  }, [state, toast, onDone]);

  return (
    <form action={action} className="space-y-7">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="icon" value={icon ?? ""} />
      <input type="hidden" name="kind" value={kind} />

      <label className="block">
        <span className="eyebrow mb-2 block">Name</span>
        <input name="name" defaultValue={category?.name} required maxLength={40} className={input} placeholder="e.g. Kids' activities" />
      </label>

      <div>
        <p className="eyebrow mb-3">Type</p>
        <div className="grid grid-cols-2 gap-2">
          {(["flexible", "fixed", "income", "transfer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cx("rounded-2xl border px-3 py-3 text-[13px] transition duration-200", kind === k ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-strong hover:text-ink")}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Icon</p>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {ICON_CHOICES.map((key) => {
            const Icon = CATEGORY_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-label={`Use the ${key} icon`}
                aria-pressed={icon === key}
                className={cx(
                  "flex aspect-square items-center justify-center rounded-full border transition duration-200",
                  icon === key ? "border-ink bg-ink text-bg" : "border-transparent text-ink-2 hover:border-line hover:text-ink",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.4} />
              </button>
            );
          })}
        </div>
      </div>

      {state && !state.ok && <p className="text-[13px] text-bad">{state.error}</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        {category ? (
          <button
            type="button"
            className={btn.danger}
            disabled={removing}
            onClick={() => {
              if (!confirm(`Remove “${category.name}”? Its transactions will go back to “to review”.`)) return;
              startRemove(async () => {
                const r = await archiveCategory(category.id);
                toast(r.ok ? (r.message ?? "Removed") : r.error, r.ok ? "ok" : "error");
                onDone();
              });
            }}
          >
            Remove
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className={btn.primary} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function RuleRow({
  rule,
  category,
}: {
  rule: { id: number; matchText: string; renameTo: string | null };
  category?: Pick<Category, "name">;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-4 px-5 py-4 text-[14px]">
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <span className="text-ink-3">Contains</span> “{rule.matchText}”
          {rule.renameTo && <span className="text-ink-3"> → shown as “{rule.renameTo}”</span>}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {category ? `→ ${category.name}` : "Removed category"}
        </p>
      </div>
      <button type="button" className={cx(btn.ghost, "text-[13px]")} disabled={pending} onClick={() => start(async () => void (await deleteRule(rule.id)))}>
        Delete
      </button>
    </div>
  );
}

export function RecategorizeButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className={btn.ghost}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await recategorizeUnreviewed();
          toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "ok" : "error");
        })
      }
    >
      {pending ? "Applying…" : "Re-apply"}
    </button>
  );
}
