import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { PaceStatus } from "@/lib/budget";
import { formatMoney } from "@/lib/money";
import { cx } from "./cx";

export { cx };

export const btn = {
  primary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[14px] font-medium text-bg transition duration-200 hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong px-5 text-[14px] font-medium text-ink transition duration-200 hover:border-ink active:scale-[0.98] disabled:opacity-40",
  ghost:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 transition duration-200 hover:text-ink",
  danger:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium text-bad transition duration-200 hover:bg-bad-soft",
};

export const input =
  "w-full rounded-2xl border border-line bg-surface px-4 h-12 text-[15px] text-ink placeholder:text-ink-3 outline-none transition duration-200 focus:border-ink";

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-[24px] border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

/** Small uppercase label with an optional hairline rule and trailing action. */
export function SectionHeader({ title, action, subtitle }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx("mb-4 flex justify-between gap-4 px-1", subtitle ? "items-end" : "items-center")}>
      <div className="min-w-0">
        <h2 className="eyebrow">{title}</h2>
        {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, eyebrow, subtitle, action }: { title: string; eyebrow?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-10 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[52px]">{title}</h1>
        {subtitle && <p className="mt-3 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Money({
  cents,
  className,
  signed,
  decimals,
}: {
  cents: number;
  className?: string;
  signed?: boolean;
  decimals?: boolean;
}) {
  return <span className={cx("num", className)}>{formatMoney(cents, { signed, decimals })}</span>;
}

const statusTone: Record<PaceStatus, { bar: string; text: string; label: string }> = {
  ok: { bar: "bg-ink", text: "text-ink-2", label: "On track" },
  ahead: { bar: "bg-warn", text: "text-warn", label: "Ahead of pace" },
  over: { bar: "bg-bad", text: "text-bad", label: "Over budget" },
  unbudgeted: { bar: "bg-ink-3", text: "text-ink-3", label: "Not planned" },
};

export function tone(status: PaceStatus) {
  return statusTone[status];
}

/**
 * A hairline budget bar. The champagne tick marks where spending would be
 * today if spread evenly across the month.
 */
export function ProgressBar({
  value,
  pace,
  status = "ok",
  size = "md",
  label,
}: {
  value: number;
  pace?: number;
  status?: PaceStatus;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const h = size === "lg" ? "h-[3px]" : "h-[2px]";
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx("relative w-full rounded-full bg-track", h)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className={cx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out", tone(status).bar)}
        style={{ width: `${pct}%` }}
      />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <div
          className={cx("absolute w-px bg-accent-mark", size === "lg" ? "-top-[7px] h-[17px]" : "-top-[5px] h-[12px]")}
          style={{ left: `${pace * 100}%` }}
          title="Where you'd be if spending evenly"
        />
      )}
    </div>
  );
}

/** A status expressed as a small dot + words — never colour alone. */
export function StatusMark({ status, children }: { status: PaceStatus; children?: ReactNode }) {
  const t = tone(status);
  return (
    <span className={cx("inline-flex items-center gap-2 text-[12px] font-medium tracking-wide", t.text)}>
      <span className={cx("size-1.5 rounded-full", status === "ok" ? "bg-accent-mark" : t.bar)} aria-hidden />
      {children ?? t.label}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-5 h-px w-10 bg-accent-mark" aria-hidden />
      <h3 className="font-display text-[26px] leading-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-7">{action}</div>}
    </Card>
  );
}

export function Chevron({ className }: { className?: string }) {
  return <ChevronRight className={cx("size-4", className)} strokeWidth={1.5} aria-hidden />;
}

export function MonthSwitcher({ label, prevHref, nextHref }: { label: string; prevHref: string; nextHref: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <Link href={prevHref} className="flex size-9 items-center justify-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" aria-label="Previous month">
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </Link>
      <span className="min-w-36 text-center font-display text-[22px]">{label}</span>
      <Link href={nextHref} className="flex size-9 items-center justify-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink" aria-label="Next month">
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
