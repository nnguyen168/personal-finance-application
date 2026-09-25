import { decodeBankFile, parseCSV } from "./csv";
import { parseOFX } from "./ofx";
import type { ParseResult } from "./types";

export type { ParseResult, ParsedTransaction } from "./types";

export function parseBankFile(fileName: string, bytes: Uint8Array): ParseResult {
  const text = decodeBankFile(bytes);
  const looksLikeOfx = /\.(ofx|qfx)$/i.test(fileName) || /<OFX>|OFXHEADER/i.test(text.slice(0, 2000));
  return looksLikeOfx ? parseOFX(text) : parseCSV(text);
}
