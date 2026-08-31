"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { shopConfig } from "@/lib/config/shop";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/cart-provider";

function minDate() {
  const date = new Date();
  date.setDate(date.getDate() + shopConfig.leadTimeDays);
  return date.toISOString().slice(0, 10);
}

export function CartSheet() {
  const {
    lines,
    subtotal,
    itemCount,
    isCartOpen,
    closeCart,
    setQuantity,
    removeLine,
    clearCart,
  } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<string>(shopConfig.fulfillment[0].id);
  const [date, setDate] = useState(minDate());
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState(false);

  const handleCheckout = async () => {
    if (!name.trim()) {
      toast.error("Necesitamos tu nombre para tomar el pedido.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name, phone, notes },
          fulfillment,
          date,
          items: lines.map((line) => ({
            productId: line.productId,
            sizeId: line.sizeId,
            quantity: line.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error ?? "No pudimos preparar el pedido.");
        return;
      }

      const order = await response.json();
      const fulfillmentLabel =
        shopConfig.fulfillment.find((option) => option.id === order.fulfillment)
          ?.label ?? order.fulfillment;

      const detail = order.lines
        .map(
          (line: {
            quantity: number;
            name: string;
            sizeLabel: string;
            lineTotal: number;
          }) =>
            `• ${line.quantity}x ${line.name} (${line.sizeLabel}) — ${formatPrice(line.lineTotal)}`,
        )
        .join("\n");

      const message = [
        `¡Hola ${shopConfig.name}! Quiero hacer un pedido.`,
        ``,
        `Pedido ${order.orderId}`,
        detail,
        ``,
        `Total: ${formatPrice(order.total)}`,
        `Entrega: ${fulfillmentLabel}`,
        `Fecha de entrega: ${order.date ?? "a coordinar"}`,
        `Nombre: ${order.customer.name}`,
        order.customer.phone ? `Teléfono: ${order.customer.phone}` : "",
        order.customer.notes ? `Notas: ${order.customer.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const url = `https://wa.me/${shopConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Te abrimos WhatsApp con el pedido listo para enviar.");
    } catch {
      toast.error("Hubo un problema al preparar el pedido. Probá de nuevo.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => (open ? null : closeCart())}>
      <SheetContent className="flex w-full flex-col gap-0 bg-[#fdf7f2] p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border/70 p-5 text-left">
          <SheetTitle className="font-display text-2xl">Mi pedido</SheetTitle>
          <SheetDescription>
            {itemCount === 0
              ? "Todavía no agregaste nada."
              : `${itemCount} ${itemCount === 1 ? "producto" : "productos"} · confirmás por WhatsApp.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="font-display text-lg">Tu pedido está vacío</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Elegí una torta del catálogo y sumala acá con el tamaño que prefieras.
              </p>
              <Button variant="secondary" className="rounded-full" onClick={closeCart}>
                Ver el catálogo
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li key={line.key} className="flex gap-3 rounded-2xl bg-card p-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.sizeLabel} · {line.sizeDetail}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Quitar ${line.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {line.notes && (
                      <p className="text-xs italic text-muted-foreground">
                        “{line.notes}”
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          aria-label="Restar"
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-6 text-center text-xs font-medium">
                          {line.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          aria-label="Sumar"
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-4 border-t border-border/70 bg-card/60 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cart-name" className="eyebrow">Nombre</Label>
                <Input
                  id="cart-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  className="rounded-xl bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cart-phone" className="eyebrow">Teléfono</Label>
                <Input
                  id="cart-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="11 ..."
                  className="rounded-xl bg-background"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cart-date" className="eyebrow">
                  Fecha de Entrega
                </Label>
                <Input
                  id="cart-date"
                  type="date"
                  min={minDate()}
                  value={date}
                  onFocus={() => setShowDeliveryNotes(true)}
                  onClick={() => setShowDeliveryNotes(true)}
                  onChange={(event) => setDate(event.target.value)}
                  className="rounded-xl bg-background"
                />
                {showDeliveryNotes && (
                  <div className="relative rounded-xl border border-border bg-secondary/60 p-3 pr-8 text-xs leading-relaxed text-secondary-foreground">
                    <button
                      type="button"
                      onClick={() => setShowDeliveryNotes(false)}
                      aria-label="Cerrar aclaraciones"
                      className="absolute right-2 top-2 text-secondary-foreground/60 transition-colors hover:text-secondary-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                    <ul className="space-y-1.5">
                      {shopConfig.deliveryNotes.map((note) => (
                        <li key={note} className="flex gap-1.5">
                          <span aria-hidden>–</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cart-fulfillment" className="eyebrow">Entrega</Label>
                <select
                  id="cart-fulfillment"
                  value={fulfillment}
                  onChange={(event) => setFulfillment(event.target.value)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {shopConfig.fulfillment.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Textarea
              value={notes}
              maxLength={400}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Aclaraciones del pedido (dirección, horario, alergias…)"
              className="min-h-16 rounded-xl bg-background"
            />

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl">{formatPrice(subtotal)}</span>
            </div>

            <Button
              className="h-12 w-full rounded-full text-base"
              onClick={handleCheckout}
              disabled={isSending}
            >
              {isSending ? "Preparando…" : "Confirmar por WhatsApp"}
            </Button>
            <button
              type="button"
              onClick={clearCart}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Vaciar pedido
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
