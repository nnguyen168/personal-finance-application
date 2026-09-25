"use client";

import { useActionState } from "react";
import { login, type ActionResult } from "@/app/actions";
import { btn, cx, input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(login, null);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form action={action} className="w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-accent text-3xl shadow-card">🔥</div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome home</h1>
          <p className="mt-1 text-sm text-ink-2">Enter the household password to see your budget.</p>
        </div>
        <input type="password" name="password" autoFocus required autoComplete="current-password" placeholder="Password" className={cx(input, "text-center")} />
        {state && !state.ok && <p className="text-sm text-bad">{state.error}</p>}
        <button type="submit" className={cx(btn.primary, "w-full")} disabled={pending}>
          {pending ? "Checking…" : "Open Hearth"}
        </button>
      </form>
    </main>
  );
}
