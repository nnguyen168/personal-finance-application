import "server-only";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import * as eb from "./bank/enablebanking";
import { addDays, todayISO } from "./dates";
import { ingestTransactions } from "./ingest";

/** How far back the first sync looks. Most French banks allow 90 days without re-authentication. */
const INITIAL_DAYS = 90;

export async function syncAccount(accountId: number): Promise<{ added: number }> {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
  if (!account || account.provider !== "enablebanking" || !account.externalId) return { added: 0 };

  try {
    const from = account.lastSyncedAt
      ? addDays(account.lastSyncedAt.slice(0, 10), -10)
      : addDays(todayISO(), -INITIAL_DAYS);
    const [txs, balances] = await Promise.all([
      eb.getTransactions(account.externalId, from),
      eb.getBalances(account.externalId).catch(() => []),
    ]);
    const result = ingestTransactions(accountId, txs.map(eb.mapTransaction), { replacePending: true });

    const bal = eb.pickBalance(balances);
    db.update(schema.accounts)
      .set({
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: null,
        ...(bal
          ? {
              balanceCents: Math.round(parseFloat(bal.balance_amount.amount) * 100),
              balanceAt: bal.reference_date ?? todayISO(),
            }
          : {}),
      })
      .where(eq(schema.accounts.id, accountId))
      .run();
    return { added: result.added };
  } catch (e) {
    const message =
      e instanceof eb.EnableBankingError && (e.status === 401 || e.status === 403)
        ? "Bank access has expired — reconnect this account."
        : e instanceof Error
          ? e.message
          : String(e);
    db.update(schema.accounts).set({ lastSyncError: message }).where(eq(schema.accounts.id, accountId)).run();
    throw new Error(message);
  }
}

export async function syncAll(): Promise<{ added: number; errors: string[] }> {
  const linked = db.select().from(schema.accounts).where(eq(schema.accounts.provider, "enablebanking")).all();
  let added = 0;
  const errors: string[] = [];
  for (const a of linked) {
    try {
      added += (await syncAccount(a.id)).added;
    } catch (e) {
      errors.push(`${a.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { added, errors };
}
