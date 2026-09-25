"use client";

import { ChartPie, House, LayoutGrid, Rows3, WalletCards, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./cx";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/transactions", label: "Activity", icon: Rows3 },
  { href: "/budget", label: "Budget", icon: ChartPie },
  { href: "/accounts", label: "Accounts", icon: WalletCards },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cx("font-display leading-none tracking-tight italic", className)}>Hearth</span>;
}

export function Nav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line px-8 py-10 lg:flex">
        <Link href="/" className="mb-14 flex items-baseline gap-2">
          <Wordmark className="text-[30px]" />
          <span className="size-1.5 rounded-full bg-accent-mark" aria-hidden />
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "group flex items-center gap-3.5 rounded-full py-2.5 text-[14px] transition duration-200",
                  active ? "font-medium text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 1.8 : 1.4} aria-hidden />
                <span className="flex-1">{label}</span>
                {href === "/transactions" && reviewCount > 0 && (
                  <span className="num text-[12px] font-medium text-accent">{reviewCount}</span>
                )}
                {active && <span className="h-px w-4 bg-ink" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto text-[12px] leading-relaxed text-ink-3">
          A calm view of
          <br />
          the household&rsquo;s money.
        </p>
      </aside>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex max-w-lg px-2">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "relative flex flex-1 flex-col items-center gap-1 pt-3 pb-2 text-[10px] tracking-wide transition duration-200",
                  active ? "font-medium text-ink" : "text-ink-3",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 1.7 : 1.3} aria-hidden />
                {label}
                {href === "/transactions" && reviewCount > 0 && (
                  <span className="absolute top-2.5 left-1/2 ml-2.5 size-1.5 rounded-full bg-accent-mark" aria-label={`${reviewCount} to review`} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
