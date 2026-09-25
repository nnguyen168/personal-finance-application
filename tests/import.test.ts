import { describe, expect, it } from "vitest";
import { decodeBankFile, parseCSV } from "@/lib/import/csv";
import { parseOFX } from "@/lib/import/ofx";
import { mapTransaction } from "@/lib/bank/enablebanking";

describe("parseCSV", () => {
  it("reads a French export with separate debit/credit columns and a preamble", () => {
    const csv = [
      "Compte joint;FR76 **** 4821",
      "Solde au 24/09/2026;2 843,12",
      "",
      "Date opération;Date valeur;Libellé;Débit;Crédit",
      "24/09/2026;24/09/2026;CB CARREFOUR MARKET 23/09;45,20;",
      '23/09/2026;23/09/2026;"VIR SEPA RECU /DE ACME; SALAIRE";;3 420,00',
      "23/09/2026;23/09/2026;CB CAFE;3,50;",
      "23/09/2026;23/09/2026;CB CAFE;3,50;",
    ].join("\r\n");
    const r = parseCSV(csv);
    expect(r.transactions.map((t) => [t.date, t.amountCents, t.description])).toEqual([
      ["2026-09-24", -4520, "CB CARREFOUR MARKET 23/09"],
      ["2026-09-23", 342000, "VIR SEPA RECU /DE ACME; SALAIRE"],
      ["2026-09-23", -350, "CB CAFE"],
      ["2026-09-23", -350, "CB CAFE"],
    ]);
    // Two identical coffees stay two transactions.
    expect(new Set(r.transactions.map((t) => t.dedupeKey)).size).toBe(4);
  });

  it("reads a single signed amount column", () => {
    const r = parseCSV("Date,Description,Amount\n2026-09-01,Netflix,-13.49\n");
    expect(r.transactions[0]).toMatchObject({ date: "2026-09-01", amountCents: -1349 });
  });

  it("decodes Windows-1252 files", () => {
    const bytes = new Uint8Array([0x44, 0xe9, 0x62, 0x69, 0x74]); // "Débit" in cp1252
    expect(decodeBankFile(bytes)).toBe("Débit");
  });
});

describe("parseOFX", () => {
  it("parses SGML OFX with balance", () => {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260912<TRNAMT>-45.20<FITID>ABC123<NAME>CB CARREFOUR<MEMO>MARKET 12/09
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260901120000<TRNAMT>3420,00<FITID>ABC124<NAME>VIR SALAIRE
</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>2843.12<DTASOF>20260924</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const r = parseOFX(ofx);
    expect(r.transactions).toEqual([
      { dedupeKey: "ofx:ABC123", date: "2026-09-12", amountCents: -4520, description: "CB CARREFOUR MARKET 12/09" },
      { dedupeKey: "ofx:ABC124", date: "2026-09-01", amountCents: 342000, description: "VIR SALAIRE" },
    ]);
    expect(r.balanceCents).toBe(284312);
    expect(r.balanceDate).toBe("2026-09-24");
  });
});

describe("Enable Banking mapping", () => {
  it("signs debits and builds a description", () => {
    const t = mapTransaction({
      entry_reference: "E1",
      transaction_amount: { amount: "45.20", currency: "EUR" },
      credit_debit_indicator: "DBIT",
      status: "BOOK",
      booking_date: "2026-09-12",
      creditor: { name: "CARREFOUR MARKET" },
      remittance_information: ["CB 12/09"],
    });
    expect(t).toEqual({ dedupeKey: "eb:E1", date: "2026-09-12", amountCents: -4520, description: "CARREFOUR MARKET CB 12/09", pending: false });
  });
});
