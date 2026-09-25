"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
    {d}
  </svg>
);

const ITEMS = [
  { href: "/", label: "Home", icon: icon(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>) },
  { href: "/transactions", label: "Activity", icon: icon(<><path d="M4 6h16M4 12h16M4 18h10" /></>) },
  { href: "/budget", label: "Budget", icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.4 6.4" /></>) },
  { href: "/accounts", label: "Accounts", icon: icon(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>) },
  { href: "/categories", label: "Categories", icon: icon(<><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z" /><circle cx="16.5" cy="16.5" r="3.5" /></>) },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-lg text-accent-ink">🔥</span>
          <span className="text-lg font-bold tracking-tight">Hearth</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition",
                  active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.href === "/transactions" && reviewCount > 0 && (
                  <span className="num rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">{reviewCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-ink-3",
                )}
              >
                {item.icon}
                {item.label}
                {item.href === "/transactions" && reviewCount > 0 && (
                  <span className="num absolute top-1 left-1/2 ml-2 min-w-5 rounded-full bg-accent px-1.5 text-center text-[10px] leading-5 font-bold text-accent-ink">
                    {reviewCount > 99 ? "99+" : reviewCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
