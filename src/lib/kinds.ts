import type { CategoryKind } from "@/db/schema";

// Kept out of client component files: a server component importing a constant
// from a "use client" module receives a client reference, not the value.
export const KIND_LABELS: Record<CategoryKind, string> = {
  flexible: "Everyday spending",
  fixed: "Fixed bills",
  income: "Income",
  transfer: "Not spending",
};
