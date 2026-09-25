"use client";

import { useActionState } from "react";
import { login, type ActionResult } from "@/app/actions";
import { Wordmark } from "@/components/nav";
import { btn, cx, input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(login, null);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form action={action} className="rise w-full max-w-xs text-center">
        <div className="flex items-baseline justify-center gap-2">
          <Wordmark className="text-[56px]" />
          <span className="size-2 rounded-full bg-accent-mark" aria-hidden />
        </div>
        <p className="mt-4 text-[14px] text-ink-2">A calm view of the household&rsquo;s money.</p>
        <div className="mx-auto my-10 h-px w-10 bg-line-strong" aria-hidden />
        <label className="eyebrow mb-3 block" htmlFor="password">
          Household password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="current-password"
          className={cx(input, "text-center tracking-[0.2em]")}
        />
        {state && !state.ok && <p className="mt-3 text-[13px] text-bad">{state.error}</p>}
        <button type="submit" className={cx(btn.primary, "mt-5 w-full")} disabled={pending}>
          {pending ? "One moment…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
