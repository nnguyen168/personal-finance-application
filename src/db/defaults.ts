import type { CategoryKind } from "./schema";

export interface DefaultCategory {
  slug: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
}

/**
 * Starter categories. Fixed = the bill is (roughly) the same every month and
 * you can't easily change it. Flexible = day-to-day spending you control.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { slug: "salary", name: "Salary", emoji: "💼", kind: "income" },
  { slug: "other-income", name: "Other income", emoji: "💶", kind: "income" },

  { slug: "mortgage", name: "Mortgage & rent", emoji: "🏠", kind: "fixed" },
  { slug: "energy", name: "Electricity & gas", emoji: "⚡", kind: "fixed" },
  { slug: "water", name: "Water", emoji: "💧", kind: "fixed" },
  { slug: "internet", name: "Internet & mobile", emoji: "📶", kind: "fixed" },
  { slug: "insurance", name: "Insurance", emoji: "🛡️", kind: "fixed" },
  { slug: "subscriptions", name: "Subscriptions", emoji: "📺", kind: "fixed" },
  { slug: "taxes", name: "Taxes", emoji: "🏛️", kind: "fixed" },

  { slug: "groceries", name: "Groceries", emoji: "🛒", kind: "flexible" },
  { slug: "restaurants", name: "Restaurants & cafés", emoji: "🍽️", kind: "flexible" },
  { slug: "clothes", name: "Clothes", emoji: "👗", kind: "flexible" },
  { slug: "entertainment", name: "Entertainment", emoji: "🎬", kind: "flexible" },
  { slug: "transport", name: "Transport & fuel", emoji: "🚆", kind: "flexible" },
  { slug: "health", name: "Health", emoji: "💊", kind: "flexible" },
  { slug: "household", name: "Home & household", emoji: "🧺", kind: "flexible" },
  { slug: "kids", name: "Kids", emoji: "🧸", kind: "flexible" },
  { slug: "beauty", name: "Beauty & care", emoji: "💅", kind: "flexible" },
  { slug: "gifts", name: "Gifts", emoji: "🎁", kind: "flexible" },
  { slug: "travel", name: "Travel", emoji: "✈️", kind: "flexible" },
  { slug: "shopping", name: "Shopping", emoji: "🛍️", kind: "flexible" },
  { slug: "cash", name: "Cash withdrawals", emoji: "🏧", kind: "flexible" },
  { slug: "other", name: "Other", emoji: "📦", kind: "flexible" },

  { slug: "transfers", name: "Transfers & savings", emoji: "🔁", kind: "transfer" },
];
