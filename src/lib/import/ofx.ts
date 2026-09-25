import { parseAmount } from "../money";
import type { ParseResult, ParsedTransaction } from "./types";

/**
 * Minimal OFX/QFX parser. Handles both SGML-style OFX 1.x (unclosed tags, as
 * exported by most French banks including CCF) and XML OFX 2.x.
 */
export function parseOFX(text: string): ParseResult {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? decodeEntities(m[1].trim()) : "";
    };
    const date = ofxDate(get("DTPOSTED"));
    const amount = parseAmount(get("TRNAMT"));
    if (!date || amount === null) {
      warnings.push("Skipped a transaction with a missing date or amount.");
      continue;
    }
    const name = get("NAME");
    const memo = get("MEMO");
    const description = [name, memo && memo !== name ? memo : ""].filter(Boolean).join(" ").trim();
    const fitid = get("FITID");
    transactions.push({
      dedupeKey: fitid ? `ofx:${fitid}` : `ofx:${date}|${amount}|${description}`,
      date,
      amountCents: amount,
      description: description || "Transaction",
    });
  }

  let balanceCents: number | undefined;
  let balanceDate: string | undefined;
  const ledger = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i);
  if (ledger) {
    const amt = ledger[1].match(/<BALAMT>([^<\r\n]*)/i);
    const dt = ledger[1].match(/<DTASOF>([^<\r\n]*)/i);
    const parsed = amt ? parseAmount(amt[1]) : null;
    if (parsed !== null) balanceCents = parsed;
    if (dt) balanceDate = ofxDate(dt[1].trim()) ?? undefined;
  }

  if (transactions.length === 0) warnings.push("No transactions found in this OFX file.");
  return { transactions, balanceCents, balanceDate, warnings };
}

function ofxDate(s: string): string | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
