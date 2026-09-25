import { describe, expect, it } from "vitest";
import { categorize, cleanMerchant } from "@/lib/categorize";

const slugToId = new Map([
  ["groceries", 1],
  ["restaurants", 2],
  ["energy", 3],
  ["salary", 4],
  ["other-income", 5],
  ["transport", 6],
  ["mortgage", 7],
]);

describe("cleanMerchant", () => {
  it.each([
    ["CB CARREFOUR MARKET 12/09 PARIS", "Carrefour Market Paris"],
    ["PRLV SEPA EDF CLIENTS PARTICULIERS", "Edf Clients Particuliers"],
    ["CARTE X1234 14/09 MONOPRIX", "Monoprix"],
    ["VIR SEPA RECU /DE ACME SAS /MOTIF SALAIRE", "Acme Sas"],
  ])("%s → %s", (raw, clean) => expect(cleanMerchant(raw)).toBe(clean));
});

describe("categorize", () => {
  it("uses built-in hints for well-known French merchants", () => {
    expect(categorize("CB CARREFOUR MARKET 12/09", -4520, [], slugToId).categoryId).toBe(1);
    expect(categorize("PRLV SEPA EDF CLIENTS", -9500, [], slugToId).categoryId).toBe(3);
    expect(categorize("PRLV SEPA CCF ECHEANCE PRET IMMO", -115000, [], slugToId).categoryId).toBe(7);
  });

  it("prefers the longest match (Uber Eats is a restaurant, not transport)", () => {
    expect(categorize("CB UBER EATS 12/09", -2300, [], slugToId).categoryId).toBe(2);
    expect(categorize("CB UBER TRIP 12/09", -1800, [], slugToId).categoryId).toBe(6);
  });

  it("only files money in as salary when it's positive", () => {
    expect(categorize("VIR SEPA RECU SALAIRE", 300000, [], slugToId).categoryId).toBe(4);
    expect(categorize("SOMETHING UNKNOWN", 1500, [], slugToId).categoryId).toBe(5);
    expect(categorize("SOMETHING UNKNOWN", -1500, [], slugToId).categoryId).toBeNull();
    expect(categorize("VIR SEPA RECU /DE HOPITAL SAINT JOSEPH /MOTIF PAIE", 218000, [], slugToId).categoryId).toBe(4);
  });

  it("lets user rules win and marks them as confirmed", () => {
    const g = categorize("CB LE PETIT ZINC 12/09", -3400, [{ matchText: "petit zinc", categoryId: 2, renameTo: "Le Petit Zinc (lunch)" }], slugToId);
    expect(g).toEqual({ categoryId: 2, merchant: "Le Petit Zinc (lunch)", fromUserRule: true });
  });
});
