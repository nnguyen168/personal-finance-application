import { CATEGORY_KINDS } from "@/db/schema";
import { authEnabled } from "@/lib/session";
import { getCategories, getRules } from "@/lib/queries";
import { KIND_LABELS } from "@/components/category-grid";
import { AddCategoryButton, CategoryRow, RecategorizeButton, RuleRow } from "@/components/category-forms";
import { logout } from "@/app/actions";
import { btn, Card, PageHeader, SectionHeader } from "@/components/ui";

export const metadata = { title: "Categories" };

const KIND_HELP: Record<(typeof CATEGORY_KINDS)[number], string> = {
  flexible: "Day-to-day spending you control. Counted in “left to spend”.",
  fixed: "Bills that are about the same every month.",
  income: "Money coming in.",
  transfer: "Moves between your own accounts, savings and card settlements — ignored by the budget.",
};

export default async function CategoriesPage() {
  const [categories, rules] = await Promise.all([getCategories(), getRules()]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <PageHeader title="Categories" subtitle="Organise spending the way your household thinks about it." action={<AddCategoryButton />} />

      {(["flexible", "fixed", "income", "transfer"] as const).map((kind) => (
        <section key={kind}>
          <SectionHeader title={KIND_LABELS[kind]} subtitle={KIND_HELP[kind]} />
          <Card className="divide-y divide-line">
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
          </Card>
        </section>
      ))}

      <section>
        <SectionHeader
          title="Auto-categorisation rules"
          subtitle="Created when you tick “Always use this” on a transaction. Built-in rules already know most French shops and billers."
          action={<RecategorizeButton />}
        />
        <Card className="divide-y divide-line">
          {rules.length ? (
            rules.map((r) => <RuleRow key={r.id} rule={r} category={byId.get(r.categoryId)} />)
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-3">No custom rules yet.</p>
          )}
        </Card>
      </section>

      {authEnabled() && (
        <form action={logout} className="flex justify-center">
          <button className={btn.ghost}>Sign out</button>
        </form>
      )}
    </div>
  );
}
