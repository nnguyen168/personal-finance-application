import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { categorize, type UserRule } from "./categorize";
import { addDays } from "./dates";
import type { ParsedTransaction } from "./import";

export interface IngestResult {
  added: number;
  skipped: number;
}

export function loadCategorizer() {
  const cats = db.select().from(schema.categories).all();
  const slugToId = new Map(cats.filter((c) => c.slug).map((c) => [c.slug!, c.id]));
  const userRules: UserRule[] = db.select().from(schema.rules).all();
  return (description: string, amountCents: number) =>
    categorize(description, amountCents, userRules, slugToId);
}

/**
 * Insert transactions for an account, skipping ones already present.
 *
 * When `replacePending` is set, the account's existing pending rows are
 * dropped first (banks re-issue pending items with new ids once they book);
 * any category someone already chose for a pending row carries over to the
 * matching new row.
 */
export function ingestTransactions(
  accountId: number,
  rows: ParsedTransaction[],
  opts: { replacePending?: boolean } = {},
): IngestResult {
  const guess = loadCategorizer();

  return db.transaction((tx) => {
    let carried: { amountCents: number; date: string; categoryId: number | null; reviewed: boolean; note: string | null; merchant: string }[] = [];
    if (opts.replacePending) {
      carried = tx
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.accountId, accountId), eq(schema.transactions.pending, true)))
        .all();
      if (carried.length) {
        tx.delete(schema.transactions)
          .where(and(eq(schema.transactions.accountId, accountId), eq(schema.transactions.pending, true)))
          .run();
      }
    }

    // Make keys unique within this batch (e.g. two identical pending coffees).
    const seen = new Map<string, number>();
    const unique = rows.map((r) => {
      const n = (seen.get(r.dedupeKey) ?? 0) + 1;
      seen.set(r.dedupeKey, n);
      return n === 1 ? r : { ...r, dedupeKey: `${r.dedupeKey}#${n}` };
    });

    const keys = unique.map((r) => r.dedupeKey);
    const existing = new Set<string>();
    for (let i = 0; i < keys.length; i += 500) {
      tx.select({ k: schema.transactions.dedupeKey })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.accountId, accountId), inArray(schema.transactions.dedupeKey, keys.slice(i, i + 500))))
        .all()
        .forEach((r) => existing.add(r.k));
    }

    let added = 0;
    for (const r of unique) {
      if (existing.has(r.dedupeKey)) continue;
      const g = guess(r.description, r.amountCents);
      let categoryId = g.categoryId;
      let merchant = g.merchant;
      let reviewed = g.fromUserRule;
      let note: string | null = null;

      const prevIdx = carried.findIndex(
        (p) => p.amountCents === r.amountCents && p.date >= addDays(r.date, -7) && p.date <= addDays(r.date, 7),
      );
      if (prevIdx > -1) {
        const prev = carried.splice(prevIdx, 1)[0];
        if (prev.reviewed) {
          categoryId = prev.categoryId;
          merchant = prev.merchant;
          reviewed = true;
        }
        note = prev.note;
      }

      tx.insert(schema.transactions)
        .values({
          accountId,
          dedupeKey: r.dedupeKey,
          date: r.date,
          amountCents: r.amountCents,
          description: r.description,
          merchant,
          categoryId,
          pending: r.pending ?? false,
          reviewed,
          note,
        })
        .run();
      added++;
    }
    return { added, skipped: unique.length - added };
  });
}
