"use server";

import { randomBytes } from "node:crypto";
import { eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { CATEGORY_KINDS } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import * as eb from "@/lib/bank/enablebanking";
import { cleanMerchant, normalize } from "@/lib/categorize";
import { addMonths, isValidMonth } from "@/lib/dates";
import { parseBankFile } from "@/lib/import";
import { ingestTransactions, loadCategorizer } from "@/lib/ingest";
import { parseAmount } from "@/lib/money";
import { budgetsFor } from "@/lib/queries";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { syncAll } from "@/lib/sync";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function refreshAll() {
  revalidatePath("/", "layout");
}

// ─── Session ────────────────────────────────────────────────────────────────

export async function login(_: unknown, form: FormData): Promise<ActionResult> {
  const password = String(form.get("password") ?? "");
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, error: "That password doesn't match." };
  }
  const { token, maxAge } = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export async function setBudget(month: string, categoryId: number, amountText: string): Promise<ActionResult> {
  await requireAuth();
  if (!isValidMonth(month)) return { ok: false, error: "Invalid month" };
  const cents = amountText.trim() === "" ? 0 : parseAmount(amountText);
  if (cents === null || cents < 0) return { ok: false, error: "Enter a positive amount" };
  db.insert(schema.budgets)
    .values({ month, categoryId, amountCents: cents })
    .onConflictDoUpdate({
      target: [schema.budgets.month, schema.budgets.categoryId],
      set: { amountCents: cents },
    })
    .run();
  refreshAll();
  return { ok: true };
}

/** Fill a month's plan from last month's plan, or from the recent average when there is none. */
export async function copyBudget(month: string, source: "last-plan" | "average"): Promise<ActionResult> {
  await requireAuth();
  if (!isValidMonth(month)) return { ok: false, error: "Invalid month" };
  const values = new Map<number, number>();
  if (source === "last-plan") {
    for (const [id, cents] of budgetsFor(addMonths(month, -1))) values.set(id, cents);
    if (values.size === 0) return { ok: false, error: "Last month has no plan to copy yet." };
  } else {
    const { getBudgetSuggestions } = await import("@/lib/queries");
    for (const [id, s] of await getBudgetSuggestions(month)) if (s.avg3 > 0) values.set(id, s.avg3);
    if (values.size === 0) return { ok: false, error: "Not enough history yet — import a few months first." };
  }
  db.transaction((tx) => {
    for (const [categoryId, amountCents] of values) {
      tx.insert(schema.budgets)
        .values({ month, categoryId, amountCents })
        .onConflictDoUpdate({ target: [schema.budgets.month, schema.budgets.categoryId], set: { amountCents } })
        .run();
    }
  });
  refreshAll();
  return { ok: true, message: `Filled ${values.size} categories.` };
}

// ─── Transactions ───────────────────────────────────────────────────────────

export async function categorizeTransaction(input: {
  id: number;
  categoryId: number | null;
  merchant?: string;
  note?: string;
  /** Also create a rule and apply it to past transactions from the same merchant. */
  remember?: boolean;
}): Promise<ActionResult> {
  await requireAuth();
  const t = db.select().from(schema.transactions).where(eq(schema.transactions.id, input.id)).get();
  if (!t) return { ok: false, error: "Transaction not found" };

  const merchant = input.merchant?.trim() || t.merchant;
  db.update(schema.transactions)
    .set({
      categoryId: input.categoryId,
      merchant,
      note: input.note === undefined ? t.note : input.note.trim() || null,
      reviewed: true,
    })
    .where(eq(schema.transactions.id, input.id))
    .run();

  let message: string | undefined;
  if (input.remember && input.categoryId) {
    // Match on the cleaned bank label (not a previous rename), exactly like the categoriser does.
    const matchText = cleanMerchant(t.description);
    const needle = normalize(matchText);
    const renameTo = merchant !== matchText ? merchant : null;
    const existing = db.select().from(schema.rules).all().find((r) => normalize(r.matchText) === needle);
    if (existing) {
      db.update(schema.rules)
        .set({ categoryId: input.categoryId, renameTo })
        .where(eq(schema.rules.id, existing.id))
        .run();
    } else {
      db.insert(schema.rules).values({ matchText, categoryId: input.categoryId, renameTo }).run();
    }
    const matching = db
      .select({ id: schema.transactions.id, description: schema.transactions.description })
      .from(schema.transactions)
      .all()
      .filter((r) => r.id !== t.id && normalize(`${r.description} ${cleanMerchant(r.description)}`).includes(needle))
      .map((r) => r.id);
    for (let i = 0; i < matching.length; i += 500) {
      db.update(schema.transactions)
        .set({ categoryId: input.categoryId, merchant, reviewed: true })
        .where(inArray(schema.transactions.id, matching.slice(i, i + 500)))
        .run();
    }
    const n = matching.length;
    message = n > 0
      ? `Updated ${n} other ${n === 1 ? "transaction" : "transactions"} from ${merchant}.`
      : `Future ${merchant} transactions will be filed automatically.`;
  }
  refreshAll();
  return { ok: true, message };
}

export async function markReviewed(ids: number[]): Promise<ActionResult> {
  await requireAuth();
  if (ids.length === 0) return { ok: true };
  db.update(schema.transactions)
    .set({ reviewed: true })
    .where(inArray(schema.transactions.id, ids))
    .run();
  refreshAll();
  return { ok: true, message: `Marked ${ids.length} as reviewed.` };
}

const manualTxSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().trim().min(1, "Add a description"),
  amount: z.string(),
  direction: z.enum(["out", "in"]),
  categoryId: z.coerce.number().int().optional(),
});

export async function addManualTransaction(_: unknown, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = manualTxSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const cents = parseAmount(d.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Enter an amount" };
  const signed = d.direction === "out" ? -Math.abs(cents) : Math.abs(cents);
  const guess = loadCategorizer()(d.merchant, signed);
  db.insert(schema.transactions)
    .values({
      accountId: d.accountId,
      dedupeKey: `manual:${randomBytes(8).toString("hex")}`,
      date: d.date,
      amountCents: signed,
      description: d.merchant,
      merchant: d.merchant,
      categoryId: d.categoryId || guess.categoryId,
      reviewed: true,
    })
    .run();
  refreshAll();
  return { ok: true, message: "Transaction added." };
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  await requireAuth();
  db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();
  refreshAll();
  return { ok: true };
}

// ─── Categories & rules ─────────────────────────────────────────────────────

const categorySchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Give it a name").max(40),
  icon: z.string().trim().max(40).optional().transform((v) => v || null),
  kind: z.enum(CATEGORY_KINDS),
});

export async function saveCategory(_: unknown, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const raw = Object.fromEntries(form);
  const parsed = categorySchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...values } = parsed.data;
  if (id) {
    db.update(schema.categories).set(values).where(eq(schema.categories.id, id)).run();
  } else {
    const max = db.select().from(schema.categories).all().reduce((m, c) => Math.max(m, c.sortOrder), 0);
    db.insert(schema.categories).values({ ...values, sortOrder: max + 1 }).run();
  }
  refreshAll();
  return { ok: true, message: id ? "Category updated." : "Category added." };
}

export async function archiveCategory(id: number): Promise<ActionResult> {
  await requireAuth();
  db.transaction((tx) => {
    tx.update(schema.categories).set({ archived: true }).where(eq(schema.categories.id, id)).run();
    // Its transactions go back to the review queue so nothing silently disappears from the budget.
    tx.update(schema.transactions)
      .set({ categoryId: null, reviewed: false })
      .where(eq(schema.transactions.categoryId, id))
      .run();
    tx.delete(schema.rules).where(eq(schema.rules.categoryId, id)).run();
  });
  refreshAll();
  return { ok: true, message: "Category removed." };
}

export async function deleteRule(id: number): Promise<ActionResult> {
  await requireAuth();
  db.delete(schema.rules).where(eq(schema.rules.id, id)).run();
  refreshAll();
  return { ok: true };
}

/** Re-run the rules over transactions nobody has confirmed yet. */
export async function recategorizeUnreviewed(): Promise<ActionResult> {
  await requireAuth();
  const guess = loadCategorizer();
  const rows = db
    .select()
    .from(schema.transactions)
    .where(or(eq(schema.transactions.reviewed, false), isNull(schema.transactions.categoryId)))
    .all();
  let changed = 0;
  db.transaction((tx) => {
    for (const r of rows) {
      const g = guess(r.description, r.amountCents);
      if (g.categoryId !== r.categoryId || g.fromUserRule) {
        tx.update(schema.transactions)
          .set({ categoryId: g.categoryId, merchant: g.merchant, reviewed: g.fromUserRule })
          .where(eq(schema.transactions.id, r.id))
          .run();
        changed++;
      }
    }
  });
  refreshAll();
  return { ok: true, message: `Re-checked ${rows.length} transactions, ${changed} updated.` };
}

// ─── Accounts, import & bank sync ───────────────────────────────────────────

export async function createAccount(_: unknown, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the account a name" };
  const balance = parseAmount(String(form.get("balance") ?? ""));
  db.insert(schema.accounts)
    .values({
      name,
      institution: String(form.get("institution") ?? "").trim(),
      balanceCents: balance,
      balanceAt: balance !== null ? new Date().toISOString().slice(0, 10) : null,
    })
    .run();
  refreshAll();
  return { ok: true, message: "Account created." };
}

export async function deleteAccount(id: number): Promise<ActionResult> {
  await requireAuth();
  db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
  refreshAll();
  return { ok: true, message: "Account and its transactions removed." };
}

export async function importFile(_: unknown, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const accountId = Number(form.get("accountId"));
  const file = form.get("file");
  if (!accountId) return { ok: false, error: "Choose an account" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to import" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "That file is larger than 10 MB" };

  const parsed = parseBankFile(file.name, new Uint8Array(await file.arrayBuffer()));
  if (parsed.transactions.length === 0) {
    return { ok: false, error: parsed.warnings[0] ?? "No transactions found in that file." };
  }
  const result = ingestTransactions(accountId, parsed.transactions);
  if (parsed.balanceCents !== undefined) {
    db.update(schema.accounts)
      .set({ balanceCents: parsed.balanceCents, balanceAt: parsed.balanceDate ?? null })
      .where(eq(schema.accounts.id, accountId))
      .run();
  }
  refreshAll();
  const dupes = result.skipped ? ` (${result.skipped} already imported)` : "";
  return { ok: true, message: `Imported ${result.added} transactions${dupes}.` };
}

export async function syncNow(): Promise<ActionResult> {
  await requireAuth();
  const r = await syncAll();
  refreshAll();
  if (r.errors.length) return { ok: false, error: r.errors.join(" · ") };
  return { ok: true, message: r.added ? `${r.added} new transactions.` : "Everything is up to date." };
}

const BANK_STATE_COOKIE = "hearth_bank_state";

export async function connectBank(form: FormData) {
  await requireAuth();
  const bank = String(form.get("bank") ?? "");
  const country = String(form.get("country") ?? "FR");
  if (!bank) throw new Error("Choose a bank");

  const h = await headers();
  const origin = process.env.PUBLIC_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const state = randomBytes(16).toString("hex");
  (await cookies()).set(BANK_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });

  const banks = await eb.listBanks(country);
  const aspsp = banks.find((b) => b.name === bank);
  const { url } = await eb.startAuthorization({
    bank,
    country,
    state,
    redirectUrl: `${origin}/api/bank/callback`,
    maxConsentSeconds: aspsp?.maximum_consent_validity,
  });
  redirect(url);
}
