import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * All money is stored as integer cents to avoid floating point drift.
 * Transaction amounts are signed: negative = money out, positive = money in.
 * Dates are stored as ISO `YYYY-MM-DD` strings (the bank's booking date),
 * which keeps month math free of time-zone surprises.
 */

export const CATEGORY_KINDS = ["income", "fixed", "flexible", "transfer"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  institution: text("institution").notNull().default(""),
  /** Last 4 characters of the IBAN, for display only. */
  ibanSuffix: text("iban_suffix"),
  currency: text("currency").notNull().default("EUR"),
  balanceCents: integer("balance_cents"),
  balanceAt: text("balance_at"),
  /** `manual` (file import / hand-entered) or `enablebanking` (PSD2 sync). */
  provider: text("provider").notNull().default("manual"),
  externalId: text("external_id"),
  sessionId: text("session_id"),
  consentExpiresAt: text("consent_expires_at"),
  lastSyncedAt: text("last_synced_at"),
  lastSyncError: text("last_sync_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Stable key for built-in categories, used by the default categorisation rules. */
  slug: text("slug").unique(),
  name: text("name").notNull(),
  /** Legacy (v1 used emoji); the UI now uses `icon`. */
  emoji: text("emoji").notNull().default("📦"),
  /** Key into the line-icon set in src/components/category-icon.tsx. */
  icon: text("icon"),
  kind: text("kind", { enum: CATEGORY_KINDS }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Unique per account; used to make imports and syncs idempotent. */
    dedupeKey: text("dedupe_key").notNull(),
    date: text("date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    merchant: text("merchant").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    pending: integer("pending", { mode: "boolean" }).notNull().default(false),
    /** False until a person has confirmed the category (auto-categorised or not). */
    reviewed: integer("reviewed", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("transactions_account_dedupe").on(t.accountId, t.dedupeKey),
    index("transactions_date").on(t.date),
    index("transactions_category").on(t.categoryId),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    /** `YYYY-MM` */
    month: text("month").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.month, t.categoryId] })],
);

/** "When the description contains X, file it under Y (and optionally rename it)." */
export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchText: text("match_text").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  renameTo: text("rename_to"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Rule = typeof rules.$inferSelect;
