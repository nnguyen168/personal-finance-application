import "server-only";

import fs from "node:fs";
import { importPKCS8, SignJWT } from "jose";

/**
 * Client for the Enable Banking API (https://enablebanking.com), a licensed
 * PSD2 aggregator that covers French banks including CCF. Its free
 * "restricted production" mode lets a household read its own linked accounts.
 *
 * Configure with:
 *   ENABLE_BANKING_APP_ID       – the application id (also the JWT `kid`)
 *   ENABLE_BANKING_PRIVATE_KEY  – PEM contents, or
 *   ENABLE_BANKING_KEY_PATH     – path to the `.pem` file downloaded at registration
 */

const API = process.env.ENABLE_BANKING_API_URL ?? "https://api.enablebanking.com";

export function isEnableBankingConfigured(): boolean {
  return !!process.env.ENABLE_BANKING_APP_ID &&
    !!(process.env.ENABLE_BANKING_PRIVATE_KEY || process.env.ENABLE_BANKING_KEY_PATH);
}

let cachedToken: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const appId = process.env.ENABLE_BANKING_APP_ID!;
  const pem =
    process.env.ENABLE_BANKING_PRIVATE_KEY?.replace(/\\n/g, "\n") ??
    fs.readFileSync(process.env.ENABLE_BANKING_KEY_PATH!, "utf8");
  const key = await importPKCS8(pem, "RS256");
  const exp = now + 3600;
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  cachedToken = { token: jwt, exp };
  return jwt;
}

export class EnableBankingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.message ?? j.detail ?? j.error ?? text;
      if (typeof msg !== "string") msg = JSON.stringify(msg);
    } catch {}
    throw new EnableBankingError(`Enable Banking ${res.status}: ${msg}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
  maximum_consent_validity?: number; // seconds
  psu_types?: string[];
}

export async function listBanks(country = "FR"): Promise<Aspsp[]> {
  const r = await call<{ aspsps: Aspsp[] }>("GET", `/aspsps?country=${encodeURIComponent(country)}`);
  return r.aspsps ?? [];
}

export async function startAuthorization(opts: {
  bank: string;
  country: string;
  redirectUrl: string;
  state: string;
  validForDays?: number;
  maxConsentSeconds?: number;
}): Promise<{ url: string }> {
  // PSD2 consents in France last up to 180 days; respect a lower bank maximum.
  let seconds = (opts.validForDays ?? 180) * 86400;
  if (opts.maxConsentSeconds) seconds = Math.min(seconds, opts.maxConsentSeconds);
  const validUntil = new Date(Date.now() + seconds * 1000).toISOString();
  return call("POST", "/auth", {
    access: { valid_until: validUntil },
    aspsp: { name: opts.bank, country: opts.country },
    state: opts.state,
    redirect_url: opts.redirectUrl,
    psu_type: "personal",
  });
}

export interface EbAccount {
  uid: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  name?: string;
  details?: string;
  product?: string;
  currency?: string;
  cash_account_type?: string;
}

export interface EbSession {
  session_id: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
  access?: { valid_until?: string };
}

export function createSession(code: string): Promise<EbSession> {
  return call("POST", "/sessions", { code });
}

export interface EbBalance {
  balance_amount: { amount: string; currency: string };
  balance_type: string;
  reference_date?: string;
}

export async function getBalances(accountUid: string): Promise<EbBalance[]> {
  const r = await call<{ balances: EbBalance[] }>("GET", `/accounts/${accountUid}/balances`);
  return r.balances ?? [];
}

export interface EbTransaction {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  status: "BOOK" | "PDNG" | string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  remittance_information?: string[] | null;
  bank_transaction_code?: { description?: string | null } | null;
}

export async function getTransactions(accountUid: string, dateFrom: string): Promise<EbTransaction[]> {
  const all: EbTransaction[] = [];
  let continuationKey: string | undefined;
  // Follow pagination, with a hard stop in case a bank keeps returning a key.
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ date_from: dateFrom });
    if (continuationKey) q.set("continuation_key", continuationKey);
    const r = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      "GET",
      `/accounts/${accountUid}/transactions?${q}`,
    );
    all.push(...(r.transactions ?? []));
    if (!r.continuation_key) break;
    continuationKey = r.continuation_key;
  }
  return all;
}

/** Pick the balance a person would call "what's in the account". */
export function pickBalance(balances: EbBalance[]): EbBalance | undefined {
  const order = ["ITAV", "CLAV", "ITBD", "CLBD", "XPCD", "OTHR"];
  const rank = (b: EbBalance) => {
    const i = order.indexOf(b.balance_type);
    return i === -1 ? order.length : i;
  };
  return [...balances].sort((a, b) => rank(a) - rank(b))[0];
}

/** Map an Enable Banking transaction into our neutral shape. */
export function mapTransaction(t: EbTransaction) {
  const amount = Math.round(parseFloat(t.transaction_amount.amount) * 100);
  const signed = t.credit_debit_indicator === "DBIT" ? -Math.abs(amount) : Math.abs(amount);
  const counterparty = signed < 0 ? t.creditor?.name : t.debtor?.name;
  const remittance = (t.remittance_information ?? []).join(" ").trim();
  const description =
    [counterparty, remittance].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() ||
    t.bank_transaction_code?.description ||
    "Transaction";
  const date = t.booking_date ?? t.transaction_date ?? t.value_date ?? new Date().toISOString().slice(0, 10);
  const pending = t.status !== "BOOK";
  const id = t.entry_reference || t.transaction_id;
  return {
    // Pending ids are not stable across banks, so pending rows are replaced on every sync.
    dedupeKey: id && !pending ? `eb:${id}` : `eb:${pending ? "p" : "b"}:${date}|${signed}|${description}`,
    date,
    amountCents: signed,
    description,
    pending,
  };
}
