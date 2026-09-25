/**
 * Fills a fresh database with ~4 months of realistic household data so you can
 * explore the app before connecting a real bank.
 *
 *   DATABASE_PATH=./data/demo.db npm run seed:demo
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { categorize } from "../src/lib/categorize";
import { DEFAULT_CATEGORIES } from "../src/db/defaults";
import * as schema from "../src/db/schema";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hearth.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
const sqlite = new Database(file);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

if (db.select().from(schema.transactions).limit(1).all().length) {
  console.error(`${file} already has transactions — refusing to add demo data. Use a new DATABASE_PATH.`);
  process.exit(1);
}
if (!db.select().from(schema.categories).limit(1).all().length) {
  db.insert(schema.categories).values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, icon: c.slug, sortOrder: i }))).run();
}
const cats = db.select().from(schema.categories).all();
const slugToId = new Map(cats.map((c) => [c.slug!, c.id]));

// Deterministic pseudo-random numbers so screenshots are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) * 100);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const today = new Date().toISOString().slice(0, 10);
const account = db
  .insert(schema.accounts)
  .values({ name: "Compte joint", institution: "CCF", ibanSuffix: "4821", balanceCents: 284_312, balanceAt: today })
  .returning()
  .get();

type Row = { date: string; amountCents: number; description: string };
const rows: Row[] = [];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const now = new Date();
for (let back = 3; back >= 0; back--) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const add = (day: number, amount: number, description: string) => {
    const date = ymd(y, m, Math.min(day, last));
    if (date <= today) rows.push({ date, amountCents: amount, description });
  };

  add(1, 3_420_00, "VIR SEPA RECU /DE ACME SAS /MOTIF SALAIRE");
  add(2, 2_180_00, "VIR SEPA RECU /DE HOPITAL SAINT JOSEPH /MOTIF PAIE");
  add(6, 186_00, "VIR SEPA RECU /DE CAF DE PARIS /MOTIF ALLOCATIONS FAMILIALES");

  add(5, -1_150_00, "PRLV SEPA CCF ECHEANCE PRET IMMO 0012345");
  add(10, -96_40 - Math.round(rand() * 800), "PRLV SEPA EDF CLIENTS PARTICULIERS");
  add(8, -39_99, "PRLV SEPA FREE HAUTDEBIT 1234567");
  add(12, -15_99, "PRLV SEPA FREE MOBILE");
  add(12, -19_99, "PRLV SEPA FREE MOBILE");
  add(15, -71_20, "PRLV SEPA MAIF ASSURANCE HABITATION AUTO");
  add(3, -13_49, "CB NETFLIX.COM 03/");
  add(14, -17_99, "CB SPOTIFY P1234 14/");
  add(20, -28_50, "PRLV SEPA VEOLIA EAU");

  for (let i = 0; i < 12; i++)
    add(1 + Math.floor(rand() * last), -between(18, 115), `CB ${pick(["CARREFOUR MARKET", "MONOPRIX", "PICARD SURGELES", "LIDL", "FRANPRIX", "BIOCOOP", "BOULANGERIE PAUL"])} ${String(Math.ceil(rand() * 28)).padStart(2, "0")}/${String(m).padStart(2, "0")} PARIS`);
  for (let i = 0; i < 5; i++)
    add(1 + Math.floor(rand() * last), -between(14, 68), `CB ${pick(["LE PETIT ZINC", "UBER EATS", "SUSHI SHOP", "CAFE DE FLORE", "PIZZERIA NAPOLI", "DELIVEROO"])} ${String(Math.ceil(rand() * 28)).padStart(2, "0")}/${String(m).padStart(2, "0")}`);
  for (let i = 0; i < 2; i++) add(1 + Math.floor(rand() * last), -between(25, 90), `CB ${pick(["ZARA", "UNIQLO", "KIABI", "VINTED", "SEZANE"])}`);
  for (let i = 0; i < 3; i++) add(1 + Math.floor(rand() * last), -between(12, 70), `CB ${pick(["TOTAL ACCESS", "SNCF CONNECT", "RATP NAVIGO", "PARKING INDIGO"])}`);
  add(1 + Math.floor(rand() * last), -between(8, 35), "CB PHARMACIE DU MARCHE");
  add(1 + Math.floor(rand() * last), -between(12, 40), `CB ${pick(["UGC CINE CITE", "FNAC", "CULTURA"])}`);
  add(1 + Math.floor(rand() * last), -between(15, 60), `CB ${pick(["IKEA", "ACTION", "LEROY MERLIN"])}`);
  add(1 + Math.floor(rand() * last), -between(10, 45), `CB ${pick(["KING JOUET", "OKAIDI", "LA GRANDE RECRE"])}`);
  add(25, -300_00, "VIR PERMANENT VERS LIVRET A");
}

const occurrences = new Map<string, number>();
const recentCutoff = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
for (const r of rows) {
  const g = categorize(r.description, r.amountCents, [], slugToId);
  const base = `demo:${r.date}|${r.amountCents}|${r.description}`;
  const n = (occurrences.get(base) ?? 0) + 1;
  occurrences.set(base, n);
  db.insert(schema.transactions)
    .values({
      accountId: account.id,
      dedupeKey: `${base}|${n}`,
      date: r.date,
      amountCents: r.amountCents,
      description: r.description,
      merchant: g.merchant,
      categoryId: g.categoryId,
      reviewed: r.date < recentCutoff && g.categoryId !== null,
    })
    .run();
}

// A sensible plan for each month.
const plan: Record<string, number> = {
  salary: 3_420_00, "other-income": 2_366_00,
  mortgage: 1_150_00, energy: 100_00, water: 30_00, internet: 76_00, insurance: 72_00, subscriptions: 32_00,
  groceries: 650_00, restaurants: 180_00, clothes: 120_00, entertainment: 60_00, transport: 150_00,
  health: 40_00, household: 60_00, kids: 50_00, beauty: 40_00, gifts: 30_00,
};
for (let back = 3; back >= 0; back--) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  const month = d.toISOString().slice(0, 7);
  for (const [slug, amountCents] of Object.entries(plan)) {
    db.insert(schema.budgets).values({ month, categoryId: slugToId.get(slug)!, amountCents }).run();
  }
}

console.log(`Seeded ${rows.length} demo transactions into ${file}`);
