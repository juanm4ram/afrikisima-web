"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/cart-provider";
import { categories } from "@/features/catalog/data/products";

export function SiteHeader() {
  const { itemCount, openCart } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-[#fdf7f2]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="shrink-0" aria-label="Afrikísima — inicio">
          <Image
            src="/brand/logo.svg"
            alt="Afrikísima"
            width={1890}
            height={581}
            className="h-7 w-auto sm:h-8"
          />
        </a>

        <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {category.name}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button
            onClick={openCart}
            variant="secondary"
            className="relative rounded-full px-4"
          >
            <ShoppingBag className="size-4" />
            <span className="hidden sm:inline">Mi pedido</span>
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
