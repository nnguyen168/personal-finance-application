import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { PaceStatus } from "@/lib/budget";
import { formatMoney } from "@/lib/money";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 h-11 text-sm font-semibold text-accent-ink transition active:scale-[0.98] hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-surface-2 px-4 h-10 text-sm font-medium text-ink transition active:scale-[0.98] hover:bg-line disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 h-9 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 h-10 text-sm font-medium text-bad transition hover:bg-bad-soft",
};

export const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 h-11 text-[15px] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-3xl bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, action, subtitle }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
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

const statusTone: Record<PaceStatus, { bar: string; text: string; soft: string }> = {
  ok: { bar: "bg-ok", text: "text-ok", soft: "bg-ok-soft" },
  ahead: { bar: "bg-warn", text: "text-warn", soft: "bg-warn-soft" },
  over: { bar: "bg-bad", text: "text-bad", soft: "bg-bad-soft" },
  unbudgeted: { bar: "bg-ink-3", text: "text-ink-2", soft: "bg-surface-2" },
};

export function tone(status: PaceStatus) {
  return statusTone[status];
}

/**
 * Horizontal budget bar. The small vertical tick marks where spending would
 * be today if spread evenly across the month — the "pace" line.
 */
export function ProgressBar({
  value,
  pace,
  status = "ok",
  color,
  size = "md",
  label,
}: {
  value: number;
  pace?: number;
  status?: PaceStatus;
  color?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const h = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";
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
        className={cx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", color ?? tone(status).bar)}
        style={{ width: `${pct}%` }}
      />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink/70"
          style={{ left: `calc(${pace * 100}% - 1px)` }}
          title="Where you'd be if spending evenly"
        />
      )}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function EmojiBadge({ emoji, className }: { emoji: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-xl", className)}
    >
      {emoji}
    </span>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cx("size-4", className)} aria-hidden>
      <path fillRule="evenodd" d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06L8.26 14.8a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}

export function MonthSwitcher({ month, label, prevHref, nextHref }: { month: string; label: string; prevHref: string; nextHref: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shadow-card" data-month={month}>
      <Link href={prevHref} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Previous month">
        <Chevron className="rotate-180" />
      </Link>
      <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
      <Link href={nextHref} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Next month">
        <Chevron />
      </Link>
    </div>
  );
}
