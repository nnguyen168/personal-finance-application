import "server-only";

import { and, asc, desc, eq, gte, isNull, like, lte, or, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import type { Category } from "@/db/schema";
import { summarizeMonth } from "./budget";
import { addMonths, monthRange, todayISO } from "./dates";

// better-sqlite3 is synchronous, so every read first opts out of build-time prerendering.

export async function getCategories(opts: { includeArchived?: boolean } = {}): Promise<Category[]> {
  await connection();
  const q = db.select().from(schema.categories);
  return (opts.includeArchived ? q : q.where(eq(schema.categories.archived, false)))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id))
    .all();
}

export function budgetsFor(month: string): Map<number, number> {
  const rows = db.select().from(schema.budgets).where(eq(schema.budgets.month, month)).all();
  return new Map(rows.map((r) => [r.categoryId, r.amountCents]));
}

export async function hasBudget(month: string): Promise<boolean> {
  await connection();
  return !!db.select({ m: schema.budgets.month }).from(schema.budgets).where(eq(schema.budgets.month, month)).limit(1).get();
}

function monthTxs(month: string) {
  const { start, end } = monthRange(month);
  return db
    .select({
      amountCents: schema.transactions.amountCents,
      categoryId: schema.transactions.categoryId,
      date: schema.transactions.date,
    })
    .from(schema.transactions)
    .where(and(gte(schema.transactions.date, start), lte(schema.transactions.date, end)))
    .all();
}

export async function getMonthSummary(month: string) {
  const categories = await getCategories();
  return summarizeMonth(month, todayISO(), categories, budgetsFor(month), monthTxs(month));
}

/** Per-category actual spend (positive) over a month, used for budgeting suggestions. */
function actualsFor(month: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of monthTxs(month)) {
    if (t.categoryId == null) continue;
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return out;
}

export interface BudgetSuggestion {
  lastBudget: number | null;
  lastActual: number;
  avg3: number;
}

export async function getBudgetSuggestions(month: string): Promise<Map<number, BudgetSuggestion>> {
  await connection();
  const prev = addMonths(month, -1);
  const lastBudgets = budgetsFor(prev);
  const actuals = [1, 2, 3].map((i) => actualsFor(addMonths(month, -i)));
  const cats = await getCategories();
  const out = new Map<number, BudgetSuggestion>();
  for (const c of cats) {
    const sign = c.kind === "income" ? 1 : -1;
    const vals = actuals.map((m) => Math.max(0, sign * (m.get(c.id) ?? 0)));
    // Average over the months that actually had activity, so a new account doesn't drag it to zero.
    const active = vals.filter((v) => v > 0);
    out.set(c.id, {
      lastBudget: lastBudgets.get(c.id) ?? null,
      lastActual: vals[0],
      avg3: active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length / 100) * 100 : 0,
    });
  }
  return out;
}

export type TxFilter = "all" | "review" | "uncategorized" | "income";

export interface TxRow {
  id: number;
  date: string;
  amountCents: number;
  merchant: string;
  description: string;
  categoryId: number | null;
  pending: boolean;
  reviewed: boolean;
  note: string | null;
  accountName: string;
}

export async function listTransactions(opts: {
  month?: string;
  q?: string;
  filter?: TxFilter;
  categoryId?: number;
  limit?: number;
}): Promise<TxRow[]> {
  await connection();
  const t = schema.transactions;
  const conds = [];
  if (opts.month) {
    const { start, end } = monthRange(opts.month);
    conds.push(gte(t.date, start), lte(t.date, end));
  }
  if (opts.q) {
    const needle = `%${opts.q.replace(/[%_]/g, "")}%`;
    conds.push(or(like(t.merchant, needle), like(t.description, needle), like(t.note, needle)));
  }
  if (opts.filter === "review") conds.push(eq(t.reviewed, false));
  if (opts.filter === "uncategorized") conds.push(isNull(t.categoryId));
  if (opts.filter === "income") conds.push(sql`${t.amountCents} > 0`);
  if (opts.categoryId) conds.push(eq(t.categoryId, opts.categoryId));

  return db
    .select({
      id: t.id,
      date: t.date,
      amountCents: t.amountCents,
      merchant: t.merchant,
      description: t.description,
      categoryId: t.categoryId,
      pending: t.pending,
      reviewed: t.reviewed,
      note: t.note,
      accountName: schema.accounts.name,
    })
    .from(t)
    .innerJoin(schema.accounts, eq(schema.accounts.id, t.accountId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.date), desc(t.id))
    .limit(opts.limit ?? 300)
    .all();
}

export async function getReviewCount(): Promise<number> {
  await connection();
  const r = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(eq(schema.transactions.reviewed, false))
    .get();
  return r?.n ?? 0;
}

export async function getAccounts() {
  await connection();
  return db.select().from(schema.accounts).orderBy(asc(schema.accounts.id)).all();
}

export async function getRules() {
  await connection();
  return db
    .select({
      id: schema.rules.id,
      matchText: schema.rules.matchText,
      renameTo: schema.rules.renameTo,
      categoryId: schema.rules.categoryId,
    })
    .from(schema.rules)
    .orderBy(asc(schema.rules.matchText))
    .all();
}

/** Monthly totals for the last `n` months, oldest first. */
export async function getSpendingHistory(month: string, n = 6) {
  const cats = await getCategories({ includeArchived: true });
  const kindOf = new Map(cats.map((c) => [c.id, c.kind]));
  const months = Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1));
  return months.map((m) => {
    let fixed = 0;
    let flexible = 0;
    let income = 0;
    for (const t of monthTxs(m)) {
      const kind = t.categoryId != null ? kindOf.get(t.categoryId) : undefined;
      if (kind === "transfer") continue;
      if (kind === "income") income += t.amountCents;
      else if (kind === "fixed") fixed -= t.amountCents;
      else if (t.amountCents < 0 || kind === "flexible") flexible -= t.amountCents;
    }
    // Refunds can outweigh spending in a category; never draw negative bars.
    return { month: m, fixed: Math.max(0, fixed), flexible: Math.max(0, flexible), income: Math.max(0, income) };
  });
}

/** The request's wall-clock time, for "synced 2 h ago"-style labels. */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
