/**
 * Configuración de la tienda Afrikísima.
 *
 * Los datos de contacto (WhatsApp y mail) NO se versionan: llegan por variables
 * de entorno para que no queden expuestos en el repositorio público. Sin ellas
 * el sitio arranca igual, pero con valores de ejemplo — ver `.env.example`.
 */

/** Valores de relleno para poder correr el proyecto sin configurar nada. */
const PLACEHOLDER = {
  whatsapp: "5490000000000",
  email: "hola@ejemplo.com",
} as const;

const whatsappNumber =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || PLACEHOLDER.whatsapp;
const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || PLACEHOLDER.email;

/** `true` cuando el contacto real está configurado. */
export const contactIsConfigured =
  whatsappNumber !== PLACEHOLDER.whatsapp && email !== PLACEHOLDER.email;

if (process.env.NODE_ENV !== "production" && !contactIsConfigured) {
  console.warn(
    "[afrikisima] Falta configurar el contacto. Copiá .env.example a .env.local " +
      "y completá NEXT_PUBLIC_WHATSAPP_NUMBER y NEXT_PUBLIC_CONTACT_EMAIL; " +
      "mientras tanto se usan datos de ejemplo.",
  );
}

export const shopConfig = {
  name: "Afrikísima",
  tagline: "Pastelería artesanal",
  city: "Tres de Febrero",
  /** Número en formato internacional sin "+" ni espacios. */
  whatsappNumber,
  email,
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM || "afrikisima_",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK || "afrikisima",
  currency: "ARS",
  currencySymbol: "$",
  /** Días mínimos de anticipación para encargar. */
  leadTimeDays: 3,
  location: "Tres de Febrero, Buenos Aires",
  /** Aclaraciones que se muestran al elegir la fecha de entrega. */
  deliveryNotes: [
    "Pedidos con 3 días de anticipación. Si querés pedir con menor tiempo de anticipación, consultá disponibilidad por WhatsApp.",
    "Horario de entregas a coordinar.",
    "Se exige una seña del 50% para tomar el pedido.",
  ],
  fulfillment: [
    { id: "retiro", label: "Retiro en domicilio" },
    { id: "envio", label: "Envío a domicilio (a coordinar)" },
  ],
} as const;

export type FulfillmentId = (typeof shopConfig.fulfillment)[number]["id"];
