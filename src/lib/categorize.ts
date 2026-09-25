/**
 * Turning raw French bank labels into something readable, and guessing a
 * category. Pure functions only — no database access — so they are easy to test.
 */

const PREFIXES: RegExp[] = [
  /^(PAIEMENT\s+)?(PAR\s+)?CARTE\s+(X|N°|NO)?\s*\d{0,4}\s*/i,
  /^(ACHAT\s+)?CB\s*\*?\s*\d{0,4}\s*/i,
  /^PRLV\s+SEPA\s*/i,
  /^PRELEVEMENT(\s+SEPA)?(\s+EUROPEEN)?\s*/i,
  /^PRELEV\.?\s*/i,
  /^ECHEANCE\s+/i,
  /^VIR(EMENT)?\s+(SEPA\s+)?(RECU|EMIS|INST(ANTANE)?|PERMANENT)?\s*(\/?\s*DE\s*:?)?\s*/i,
  /^RETRAIT\s+(DAB|GAB)\s*/i,
  /^FACTURE\s+CARTE\s*/i,
  /^DU\s+\d{6}\s*/i,
];

const NOISE: RegExp[] = [
  /\b\d{2}[/.]\d{2}([/.]\d{2,4})?\b/g, // dates like 12/09 or 12/09/26
  /\bX{2,}\d+\b/gi, // masked card numbers
  /\b(REF|MDT|RUM|ID EMETTEUR|NNE|CB)\s*:?\s*[A-Z0-9-]{6,}\b.*$/i, // SEPA refs trail
  /\/(MOTIF|REF|RUM|MDT).*$/i,
  /\s+\d{5,}.*$/, // long numeric references at the end
  /\*+/g,
];

const LOWER_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "au", "en", "sur"]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && LOWER_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "CB CARREFOUR MARKET 12/09 PARIS" → "Carrefour Market Paris" */
export function cleanMerchant(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) for (const p of PREFIXES) s = s.replace(p, "");
  for (const n of NOISE) s = s.replace(n, " ");
  s = s.replace(/\s+/g, " ").replace(/^[\s\-:/.]+|[\s\-:/.]+$/g, "").trim();
  if (!s) s = raw.trim();
  // Keep at most the first 5 words — the tail is usually a city or a reference.
  const words = s.split(" ");
  if (words.length > 5) s = words.slice(0, 5).join(" ");
  return titleCase(s);
}

/** Uppercase, accent-free, single-spaced — the form rules are matched against. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Built-in hints for common French merchants and billers, keyed by default
 * category slug. User rules always take precedence over these.
 */
export const BUILTIN_HINTS: Array<{ slug: string; patterns: string[]; incomeOnly?: boolean }> = [
  { slug: "salary", incomeOnly: true, patterns: ["SALAIRE", "PAIE ", "REMUNERATION", "PAYROLL"] },
  { slug: "other-income", incomeOnly: true, patterns: ["CAF ", "ALLOCATIONS FAMILIALES", "CPAM", "REMBOURSEMENT", "AMELI", "DGFIP REMB"] },
  { slug: "mortgage", patterns: ["PRET IMMO", "ECHEANCE PRET", "ECH PRET", "CREDIT IMMOBILIER", "LOYER", "FONCIA", "NEXITY"] },
  { slug: "energy", patterns: ["EDF", "ENGIE", "TOTALENERGIES ELEC", "TOTAL DIRECT ENERGIE", "ENI GAS", "EKWATEUR", "GRDF", "PLUM ENERGIE", "MINT ENERGIE", "OHM ENERGIE"] },
  { slug: "water", patterns: ["VEOLIA", "SUEZ", "EAU DE PARIS", "SAUR "] },
  { slug: "internet", patterns: ["FREE MOBILE", "FREE TELECOM", "ORANGE", "SOSH", "SFR", "RED BY SFR", "BOUYGUES TEL", "B&YOU", "FREE HAUTDEBIT"] },
  { slug: "insurance", patterns: ["AXA", "MAIF", "MACIF", "MAAF", "MATMUT", "ALLIANZ", "GROUPAMA", "GENERALI", "MUTUELLE", "ALAN ", "ASSURANCE", "LUKO", "HISCOX"] },
  { slug: "subscriptions", patterns: ["NETFLIX", "SPOTIFY", "DISNEY PLUS", "DISNEYPLUS", "CANAL+", "CANAL PLUS", "DEEZER", "APPLE.COM/BILL", "APPLE COM BILL", "GOOGLE ONE", "YOUTUBE PREMIUM", "AMAZON PRIME", "PRIME VIDEO", "ICLOUD", "OPENAI", "CHATGPT", "CLAUDE.AI", "ANTHROPIC"] },
  { slug: "taxes", patterns: ["DGFIP", "IMPOT", "TAXE FONCIERE", "TAXE HABITATION", "TRESOR PUBLIC"] },
  { slug: "groceries", patterns: ["CARREFOUR", "LECLERC", "AUCHAN", "INTERMARCHE", "LIDL", "ALDI", "MONOPRIX", "FRANPRIX", "CASINO", "SUPER U", "HYPER U", "MARCHE U", "U EXPRESS", "PICARD", "GRAND FRAIS", "NATURALIA", "BIOCOOP", "LA VIE CLAIRE", "NETTO", "COLRUYT", "SPAR", "PROXI", "COCCINELLE", "BOUCHERIE", "BOULANGERIE", "FROMAGERIE", "PRIMEUR", "G20", "LEADER PRICE", "CORA", "MATCH "] },
  { slug: "restaurants", patterns: ["RESTAURANT", "RESTO", "BRASSERIE", "CAFE ", "BISTRO", "PIZZ", "SUSHI", "BURGER", "MCDONALD", "MC DONALD", "KFC", "QUICK", "STARBUCKS", "PAUL ", "PRET A MANGER", "UBER EATS", "UBER *EATS", "DELIVEROO", "JUST EAT", "BOUILLON", "TRAITEUR", "BAR "] },
  { slug: "clothes", patterns: ["ZARA", "H&M", "H & M", "UNIQLO", "KIABI", "PRIMARK", "MANGO", "PROMOD", "CELIO", "JULES", "SEZANE", "GALERIES LAFAYETTE", "PRINTEMPS", "VINTED", "ZALANDO", "SHEIN", "BERSHKA", "PULL&BEAR", "PULL AND BEAR", "COS ", "IKKS", "CAMAIEU", "OKAIDI", "VERTBAUDET"] },
  { slug: "entertainment", patterns: ["CINEMA", "UGC", "PATHE", "GAUMONT", "MK2", "FNAC", "CULTURA", "TICKETMASTER", "FNAC SPECTACLES", "STEAM", "PLAYSTATION", "NINTENDO", "MUSEE", "THEATRE", "CONCERT", "BOWLING"] },
  { slug: "transport", patterns: ["SNCF", "RATP", "NAVIGO", "UBER", "BOLT", "HEETCH", "G7", "BLABLACAR", "TOTAL ", "TOTALENERGIES", "ESSO", "SHELL", "BP ", "AVIA", "STATION", "PEAGE", "VINCI AUTOROUTES", "SANEF", "APRR", "PARKING", "INDIGO", "SAEMES", "LIME", "VELIB", "TCL", "TISSEO", "TRANSDEV", "OUIGO", "TRAINLINE"] },
  { slug: "health", patterns: ["PHARMACIE", "PHARMA", "DOCTOLIB", "MEDECIN", "DR ", "DENTISTE", "OPTIC", "KRYS", "AFFLELOU", "LABORATOIRE", "LABO ", "HOPITAL", "CLINIQUE", "KINE", "OSTEO"] },
  { slug: "household", patterns: ["IKEA", "LEROY MERLIN", "CASTORAMA", "BRICORAMA", "BRICOMARCHE", "CONFORAMA", "BUT ", "MAISONS DU MONDE", "ACTION ", "DARTY", "BOULANGER ", "GIFI", "LA FOIR'FOUILLE", "HEMA", "MR BRICOLAGE", "TRUFFAUT", "JARDILAND", "PRESSING"] },
  { slug: "kids", patterns: ["KING JOUET", "LA GRANDE RECRE", "JOUE CLUB", "TOYS R US", "AUBERT", "CRECHE", "NOUNOU", "PAJEMPLOI", "CANTINE", "PERISCOLAIRE", "ECOLE"] },
  { slug: "beauty", patterns: ["SEPHORA", "NOCIBE", "MARIONNAUD", "YVES ROCHER", "COIFF", "BARBER", "ESTHETIQUE", "INSTITUT", "L OCCITANE", "KIKO", "RITUALS"] },
  { slug: "gifts", patterns: ["INTERFLORA", "FLEURISTE", "NATURE ET DECOUVERTES"] },
  { slug: "travel", patterns: ["AIR FRANCE", "EASYJET", "RYANAIR", "TRANSAVIA", "VUELING", "BOOKING.COM", "BOOKING COM", "AIRBNB", "HOTEL", "EXPEDIA", "ACCOR", "IBIS", "PIERRE ET VACANCES", "CENTER PARCS"] },
  { slug: "shopping", patterns: ["AMAZON", "AMZN", "CDISCOUNT", "DECATHLON", "ALIEXPRESS", "ETSY", "APPLE STORE", "LEBONCOIN", "RAKUTEN", "FNAC.COM"] },
  { slug: "cash", patterns: ["RETRAIT DAB", "RETRAIT GAB", "RETRAIT ", "DAB "] },
  { slug: "transfers", patterns: ["VIR INTERNE", "VIREMENT INTERNE", "VERS LIVRET", "LIVRET A", "LDDS", "EPARGNE", "VIR PERMANENT", "PEA ", "ASSURANCE VIE", "REMBOURSEMENT CARTE", "RELEVE CARTE", "FACTURE CARTE", "DEBIT DIFFERE"] },
];

export interface UserRule {
  matchText: string;
  categoryId: number;
  renameTo: string | null;
}

export interface CategoryGuess {
  categoryId: number | null;
  merchant: string;
  /** True when a user-defined rule matched — those don't need review. */
  fromUserRule: boolean;
}

/**
 * Decide the merchant name and category for a raw bank label.
 *
 * @param slugToId maps default category slugs to the ids in this database.
 */
export function categorize(
  description: string,
  amountCents: number,
  userRules: UserRule[],
  slugToId: Map<string, number>,
): CategoryGuess {
  const merchant = cleanMerchant(description);
  const haystack = normalize(`${description} ${merchant}`);

  // Longest rule wins, so "UBER EATS" beats "UBER".
  const sortedRules = [...userRules].sort((a, b) => b.matchText.length - a.matchText.length);
  for (const r of sortedRules) {
    const needle = normalize(r.matchText);
    if (needle && haystack.includes(needle)) {
      return { categoryId: r.categoryId, merchant: r.renameTo || merchant, fromUserRule: true };
    }
  }

  // Money in checks income patterns first, so "HOPITAL … PAIE" is a salary, not a health expense.
  const findBest = (hints: typeof BUILTIN_HINTS) => {
    let best: { slug: string; len: number } | null = null;
    for (const hint of hints) {
      for (const p of hint.patterns) {
        if (haystack.includes(p) && (!best || p.length > best.len)) best = { slug: hint.slug, len: p.length };
      }
    }
    return best;
  };
  const best =
    (amountCents > 0 ? findBest(BUILTIN_HINTS.filter((h) => h.incomeOnly)) : null) ??
    findBest(BUILTIN_HINTS.filter((h) => !h.incomeOnly));
  // Don't file incoming money under an expense category (refunds excepted: those stay in their category).
  let categoryId = best ? (slugToId.get(best.slug) ?? null) : null;
  if (categoryId === null && amountCents > 0) categoryId = slugToId.get("other-income") ?? null;

  return { categoryId, merchant, fromUserRule: false };
}
