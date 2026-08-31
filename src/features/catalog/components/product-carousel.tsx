"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCard } from "./product-card";
import type { Product } from "../types";

/** Separación entre tarjetas, en px. Tiene que coincidir con el gap de la grilla. */
const GAP = 20;

/**
 * Cuántas tarjetas entran a la vez.
 * `0` = viewport mobile (sin carrusel), `null` = todavía no se montó en el
 * cliente (en ese caso se pinta la grilla, que es lo que renderiza el servidor).
 */
function usePerView() {
  const [perView, setPerView] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setPerView(width < 768 ? 0 : width < 1024 ? 2 : 3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return perView;
}

interface ProductCarouselProps {
  items: Product[];
  onSelect: (product: Product) => void;
}

export function ProductCarousel({ items, onSelect }: ProductCarouselProps) {
  const perView = usePerView();
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  // Después de saltar sin animación, se vuelve a habilitar en el frame siguiente.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  // Si cambia la categoría o el ancho, se vuelve al principio.
  useEffect(() => {
    setIndex(0);
  }, [items, perView]);

  // Mobile y primer render: grilla común, sin carrusel.
  if (perView === null || perView === 0) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const slideWidth = `calc((100% - ${(perView - 1) * GAP}px) / ${perView})`;

  // Con pocos productos no hay nada que rotar: se centran y listo.
  if (items.length <= perView) {
    return (
      <div className="flex justify-center" style={{ gap: GAP }}>
        {items.map((product) => (
          <div key={product.id} style={{ width: slideWidth }} className="shrink-0">
            <ProductCard product={product} onSelect={onSelect} />
          </div>
        ))}
      </div>
    );
  }

  // Se triplica la lista para que el loop no tenga costuras: siempre se navega
  // sobre la copia del medio y, al salirse, se salta a la equivalente sin animar.
  const track = [...items, ...items, ...items];
  const position = items.length + index;

  const handleTransitionEnd = () => {
    if (index >= items.length || index <= -items.length) {
      setAnimate(false);
      setIndex(((index % items.length) + items.length) % items.length);
    }
  };

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div
          className="flex"
          onTransitionEnd={handleTransitionEnd}
          style={{
            gap: GAP,
            transform: `translateX(calc(${-position} * (${slideWidth} + ${GAP}px)))`,
            transition: animate
              ? "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
          }}
        >
          {track.map((product, slot) => (
            <div
              key={`${product.id}-${slot}`}
              style={{ width: slideWidth }}
              className="shrink-0"
              aria-hidden={
                slot < items.length || slot >= items.length * 2 ? true : undefined
              }
            >
              <ProductCard product={product} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </div>

      <CarouselButton side="left" onClick={() => setIndex((i) => i - 1)} />
      <CarouselButton side="right" onClick={() => setIndex((i) => i + 1)} />
    </div>
  );
}

function CarouselButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Ver anteriores" : "Ver siguientes"}
      className={`absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-[#fdf7f2]/95 text-primary shadow-md backdrop-blur transition-transform hover:scale-105 ${
        side === "left" ? "-left-3" : "-right-3"
      }`}
    >
      <Icon className="size-5" />
    </button>
  );
}
