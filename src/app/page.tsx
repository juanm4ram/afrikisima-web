import { HeroBanner } from "@/components/layout/hero-banner";
import { CatalogSection } from "@/features/catalog";
import { SiteFooter } from "@/components/layout/site-footer";

export default function AfrikisimaPage() {
  return (
    <>
      <span id="top" />
      <HeroBanner />
      <main className="pt-10">
        <CatalogSection />
      </main>
      <SiteFooter />
    </>
  );
}
