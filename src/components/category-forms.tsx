"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { archiveCategory, deleteRule, recategorizeUnreviewed, saveCategory, type ActionResult } from "@/app/actions";
import type { Category, CategoryKind } from "@/db/schema";
import { KIND_LABELS } from "./category-grid";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { btn, cx, EmojiBadge, input } from "./ui";

const EMOJIS = ["🛒", "🍽️", "☕", "🥖", "🍷", "👗", "👟", "🎬", "🎮", "📚", "🚆", "⛽", "🚗", "💊", "🧺", "🧸", "🐶", "💅", "🎁", "✈️", "🏖️", "🛍️", "🏠", "⚡", "💧", "📶", "🛡️", "📺", "🏛️", "🎓", "🏋️", "🎵", "💼", "💶", "🔁", "📦"];

export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={btn.primary} onClick={() => setOpen(true)}>
        <span className="text-lg leading-none">+</span>
        <span className="hidden sm:inline">New category</span>
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
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60">
        <EmojiBadge emoji={category.emoji} />
        <span className="flex-1 font-medium">{category.name}</span>
        <span className="text-[13px] text-ink-3">Edit</span>
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
  const [emoji, setEmoji] = useState(category?.emoji ?? "📦");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "flexible");
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Saved");
      onDone();
    }
  }, [state, toast, onDone]);

  return (
    <form action={action} className="space-y-4">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="kind" value={kind} />

      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-3">Name</span>
        <input name="name" defaultValue={category?.name} required maxLength={40} className={input} placeholder="e.g. Kids' activities" />
      </label>

      <div>
        <p className="mb-1.5 text-[13px] text-ink-3">Type</p>
        <div className="grid grid-cols-2 gap-2">
          {(["flexible", "fixed", "income", "transfer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cx("rounded-2xl border px-3 py-2.5 text-sm font-medium transition", kind === k ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-surface-2")}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] text-ink-3">Icon</p>
        <div className="grid grid-cols-9 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-label={`Use ${e}`}
              aria-pressed={emoji === e}
              className={cx("flex aspect-square items-center justify-center rounded-xl text-xl transition", emoji === e ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-surface-2")}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}

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
  category?: Pick<Category, "emoji" | "name">;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate">
          Contains <strong className="font-semibold">“{rule.matchText}”</strong>
          {rule.renameTo && <span className="text-ink-3"> → shown as “{rule.renameTo}”</span>}
        </p>
        <p className="text-[13px] text-ink-3">
          {category ? `${category.emoji} ${category.name}` : "Removed category"}
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
