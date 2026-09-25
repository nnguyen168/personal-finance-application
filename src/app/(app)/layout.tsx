import { Nav } from "@/components/nav";
import { getReviewCount } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const reviewCount = await getReviewCount();
  return (
    <>
      <Nav reviewCount={reviewCount} />
      <main className="px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-36 sm:px-8 lg:ml-64 lg:px-16 lg:pt-16 lg:pb-24">
        <div className="rise mx-auto max-w-2xl">{children}</div>
      </main>
    </>
  );
}
