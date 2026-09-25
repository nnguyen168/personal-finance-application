export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EUR";
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "fr-FR";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(decimals: boolean, signed: boolean) {
  const key = `${decimals}-${signed}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
      signDisplay: signed ? "exceptZero" : "auto",
    });
    formatters.set(key, f);
  }
  return f;
}

/** Format integer cents, e.g. `-123456` → `-1 234,56 €`. */
export function formatMoney(
  cents: number,
  opts: { decimals?: boolean; signed?: boolean } = {},
): string {
  const decimals = opts.decimals ?? cents % 100 !== 0;
  // Intl uses narrow no-break spaces in fr-FR; normalise so text wraps predictably.
  return formatter(decimals, opts.signed ?? false)
    .format(cents / 100)
    .replace(/ /g, " ");
}

/**
 * Parse a human/bank amount into cents. Accepts both French (`1 234,56`) and
 * English (`1,234.56`) conventions, currency symbols and a leading +/-.
 * Returns null when the text is not a number.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/[€$£\s  ]/g, "").replace(/EUR$/i, "");
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    // A lone comma followed by exactly 3 digits and more than one group is a thousands separator ("1,234,567").
    const parts = s.split(",");
    s = parts.length > 2 ? parts.join("") : s.replace(",", ".");
  } else if (lastDot > -1 && s.split(".").length > 2) {
    s = s.split(".").join("");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return negative ? -cents : cents;
}
