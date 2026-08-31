"use client";

import { useMemo, useState } from "react";

import { ProductCarousel } from "./product-carousel";
import { ProductDialog } from "./product-dialog";
import { categories, products } from "@/features/catalog/data/products";
import type { Product } from "@/features/catalog/types";

export function CatalogSection() {
  const [selected, setSelected] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("todo");

  const grouped = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          items: products.filter((product) => product.categoryId === category.id),
        }))
        .filter((category) => category.items.length > 0),
    [],
  );

  const visible =
    activeCategory === "todo"
      ? grouped
      : grouped.filter((category) => category.id === activeCategory);

  return (
    <section id="catalogo" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div className="sticky top-16 z-30 -mx-4 mb-8 bg-[#fdf7f2]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[{ id: "todo", name: "Todo" }, ...categories].map((category) => {
            const active = category.id === activeCategory;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-14">
        {visible.map((category) => (
          <div key={category.id} id={category.id} className="scroll-mt-32">
            <div className="mb-5 flex items-baseline gap-3">
              <h2 className="font-display text-2xl sm:text-3xl">{category.name}</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {category.items.length}
              </span>
            </div>

            <ProductCarousel items={category.items} onSelect={setSelected} />
          </div>
        ))}
      </div>

      <ProductDialog
        product={selected}
        onOpenChange={(open) => (open ? null : setSelected(null))}
      />
    </section>
  );
}
