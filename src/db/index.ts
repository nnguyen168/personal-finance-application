import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { DEFAULT_CATEGORIES } from "./defaults";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

function open(): DB {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hearth.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seedDefaults(db);
  return db;
}

function seedDefaults(db: DB) {
  const existing = db.select({ id: schema.categories.id }).from(schema.categories).limit(1).all();
  if (existing.length > 0) return;
  db.insert(schema.categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, icon: c.slug, sortOrder: i })))
    .run();
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __hearthDb?: DB };

export const db: DB = globalForDb.__hearthDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__hearthDb = db;

export { schema };
