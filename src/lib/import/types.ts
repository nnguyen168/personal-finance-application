export interface ParsedTransaction {
  /** Stable id used for de-duplication across repeated imports of overlapping files. */
  dedupeKey: string;
  date: string; // YYYY-MM-DD
  amountCents: number; // negative = money out
  description: string;
  pending?: boolean;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  /** Closing balance when the file carries one (OFX does). */
  balanceCents?: number;
  balanceDate?: string;
  warnings: string[];
}

/** Adds an occurrence counter so two identical coffees on the same day both survive. */
export function withOccurrenceKeys(
  rows: Omit<ParsedTransaction, "dedupeKey">[],
  prefix: string,
): ParsedTransaction[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date}|${r.amountCents}|${r.description.replace(/\s+/g, " ").trim().toUpperCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, dedupeKey: `${prefix}:${base}|${n}` };
  });
}
