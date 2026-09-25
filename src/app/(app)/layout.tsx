import { Nav } from "@/components/nav";
import { getReviewCount } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const reviewCount = await getReviewCount();
  return (
    <>
      <Nav reviewCount={reviewCount} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32 sm:px-6 lg:ml-60 lg:max-w-none lg:px-10 lg:pt-10 lg:pb-16">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </>
  );
}
