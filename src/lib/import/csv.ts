import { parseAmount } from "../money";
import { normalize } from "../categorize";
import { withOccurrenceKeys, type ParseResult } from "./types";

/**
 * Parses bank CSV exports without needing a column mapping screen: it finds the
 * header row and recognises the usual French and English column names
 * ("Date opération", "Libellé", "Débit", "Crédit", "Montant", …).
 */

const DATE_COLS = ["DATE OPERATION", "DATE DE L'OPERATION", "DATE D'OPERATION", "DATE COMPTABLE", "DATE", "BOOKING DATE", "TRANSACTION DATE", "DATE VALEUR", "DATE DE VALEUR"];
const DESC_COLS = ["LIBELLE OPERATION", "LIBELLE", "LIBELLE SIMPLIFIE", "DESCRIPTION", "LABEL", "INTITULE", "DETAIL", "DETAILS", "MEMO", "NAME", "PAYEE"];
const EXTRA_DESC_COLS = ["INFORMATIONS COMPLEMENTAIRES", "LIBELLE COMPLEMENTAIRE", "REFERENCE"];
const AMOUNT_COLS = ["MONTANT", "MONTANT (EUR)", "MONTANT EN EUROS", "AMOUNT", "SOMME", "VALEUR"];
const DEBIT_COLS = ["DEBIT", "DEBIT (EUR)", "DEBIT EUROS", "DEBIT EN EUROS", "SORTIE", "WITHDRAWAL", "MONEY OUT"];
const CREDIT_COLS = ["CREDIT", "CREDIT (EUR)", "CREDIT EUROS", "CREDIT EN EUROS", "ENTREE", "DEPOSIT", "MONEY IN"];

export function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t", "|"].map((d) => ({ d, n: splitCsvLine(line, d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].d;
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const i = headers.indexOf(name);
    if (i > -1) return i;
  }
  for (const name of names) {
    const i = headers.findIndex((h) => h.startsWith(name));
    if (i > -1) return i;
  }
  return -1;
}

export function parseDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    // French banks use day/month/year.
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function parseCSV(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { transactions: [], warnings: ["The file is empty."] };

  // The header is the first line that has a date column and some amount column.
  let headerIdx = -1;
  let delim = ";";
  let headers: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const d = detectDelimiter(lines[i]);
    const h = splitCsvLine(lines[i], d).map(normalize);
    const hasDate = findCol(h, DATE_COLS) > -1;
    const hasAmount = findCol(h, AMOUNT_COLS) > -1 || findCol(h, DEBIT_COLS) > -1;
    if (hasDate && hasAmount) {
      headerIdx = i;
      delim = d;
      headers = h;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      transactions: [],
      warnings: ["Couldn't find the column headers (expected a date, a label and an amount column)."],
    };
  }

  const dateCol = findCol(headers, DATE_COLS);
  const descCol = findCol(headers, DESC_COLS);
  const extraCol = findCol(headers, EXTRA_DESC_COLS);
  const amountCol = findCol(headers, AMOUNT_COLS);
  const debitCol = findCol(headers, DEBIT_COLS);
  const creditCol = findCol(headers, CREDIT_COLS);

  const rows: { date: string; amountCents: number; description: string }[] = [];
  let skipped = 0;
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line, delim);
    const date = parseDate(cells[dateCol] ?? "");
    let amount: number | null = null;
    if (amountCol > -1 && cells[amountCol]) {
      amount = parseAmount(cells[amountCol]);
    } else {
      const debit = debitCol > -1 && cells[debitCol] ? parseAmount(cells[debitCol]) : null;
      const credit = creditCol > -1 && cells[creditCol] ? parseAmount(cells[creditCol]) : null;
      // Debit columns are sometimes already negative, sometimes not.
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null) amount = Math.abs(credit);
    }
    if (!date || amount === null) {
      skipped++;
      continue;
    }
    const parts = [cells[descCol] ?? "", extraCol > -1 ? (cells[extraCol] ?? "") : ""];
    const description = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || "Transaction";
    rows.push({ date, amountCents: amount, description });
  }
  if (skipped > 0) warnings.push(`Skipped ${skipped} line(s) without a valid date or amount.`);

  return { transactions: withOccurrenceKeys(rows, "csv"), warnings };
}

/** Bank CSVs are frequently Windows-1252; fall back to it when UTF-8 decoding fails. */
export function decodeBankFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
