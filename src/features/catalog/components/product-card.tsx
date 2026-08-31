"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/features/catalog/types";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const from = Math.min(...product.sizes.map((size) => size.price));

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(74,43,51,0.04)] transition-shadow hover:shadow-[0_12px_32px_rgba(74,43,51,0.10)]">
      <button
        type="button"
        onClick={() => onSelect(product)}
        className="relative aspect-square w-full overflow-hidden"
        aria-label={`Ver ${product.name}`}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.tags?.[0] && (
          <span className="absolute left-3 top-3 rounded-full bg-[#fdf7f2]/90 px-3 py-1 text-[11px] font-medium tracking-wide text-primary backdrop-blur">
            {product.tags[0]}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="font-display text-xl leading-tight">{product.name}</h3>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <p className="eyebrow">Desde</p>
            <p className="font-display text-lg text-primary">
              {formatPrice(from)}
            </p>
          </div>
          <Button
            onClick={() => onSelect(product)}
            className="rounded-full px-5"
          >
            Elegir tamaño
          </Button>
        </div>
      </div>
    </article>
  );
}
