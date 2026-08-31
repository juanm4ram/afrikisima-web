"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { shopConfig } from "@/lib/config/shop";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/cart-provider";
import type { Product } from "@/features/catalog/types";

interface ProductDialogProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
}

export function ProductDialog({ product, onOpenChange }: ProductDialogProps) {
  const { addLine } = useCart();
  const [sizeId, setSizeId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    if (!product) return;
    setSizeId(product.sizes[0]?.id ?? "");
    setQuantity(1);
    setNotes("");
    setActiveImage(product.image);
  }, [product]);

  if (!product) return null;

  const size = product.sizes.find((item) => item.id === sizeId) ?? product.sizes[0];
  const gallery = product.gallery ?? [product.image];

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-3xl">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="bg-muted/60">
            <div className="relative aspect-[4/3] w-full md:aspect-square">
              <Image
                src={activeImage || product.image}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {gallery.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    className={`relative size-14 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                      activeImage === image ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <Image src={image} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5 p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-display text-2xl">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {product.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label className="eyebrow">Tamaño</Label>
              <div className="grid gap-2">
                {product.sizes.map((option) => {
                  const selected = option.id === size.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSizeId(option.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-primary bg-secondary/70"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.detail}
                        </span>
                      </span>
                      <span className="font-display text-base text-primary">
                        {formatPrice(option.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="eyebrow">
                Comentarios (opcional)
              </Label>
              <Textarea
                id="notes"
                value={notes}
                maxLength={280}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej: sin nueces, mensaje en la torta, color del buttercream…"
                className="min-h-20 rounded-2xl bg-background"
              />
            </div>

            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Restar"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                    aria-label="Sumar"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="font-display text-xl">
                  {formatPrice(size.price * quantity)}
                </p>
              </div>

              <Button
                className="h-11 w-full rounded-full text-base"
                onClick={() => {
                  addLine(product, size, quantity, notes);
                  onOpenChange(false);
                }}
              >
                Agregar al pedido
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Encargos con {shopConfig.leadTimeDays} días de anticipación.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
