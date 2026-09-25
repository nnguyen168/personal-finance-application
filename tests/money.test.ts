import { describe, expect, it } from "vitest";
import { formatMoney, parseAmount } from "@/lib/money";

describe("parseAmount", () => {
  it.each([
    ["12,50", 1250],
    ["-12,50", -1250],
    ["1 234,56", 123456],
    ["1 234,56 €", 123456],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["+3420.00", 342000],
    ["42", 4200],
    ["(15,00)", -1500],
    ["15,00-", -1500],
    ["1,234,567", 123456700],
  ])("%s → %d", (input, cents) => expect(parseAmount(input)).toBe(cents));

  it("rejects non-numbers", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats euros the French way", () => {
    expect(formatMoney(123456)).toBe("1 234,56 €");
    expect(formatMoney(120000)).toBe("1 200 €");
    expect(formatMoney(1250, { signed: true })).toBe("+12,50 €");
  });
});
