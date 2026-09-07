import { HeroBanner } from "@/components/layout/hero-banner";
import { CatalogSection } from "@/features/catalog";
import { SiteFooter } from "@/components/layout/site-footer";
import { loadCatalog } from "@/features/catalog/data/catalog-repository";

export const revalidate = 60;

export default async function AfrikisimaPage() {
  const { categories, products } = await loadCatalog();

  return (
    <>
      <span id="top" />
      <HeroBanner />
      <main className="pt-10">
        <CatalogSection categories={categories} products={products} />
      </main>
      <SiteFooter />
    </>
  );
}
