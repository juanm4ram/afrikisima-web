import { shopConfig } from "@/lib/config/shop";

/** Precios en pesos argentinos, sin decimales. */
export function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: shopConfig.currency,
    maximumFractionDigits: 0,
  }).format(value);
}
