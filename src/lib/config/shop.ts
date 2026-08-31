/**
 * Configuración de la tienda Afrikísima.
 * Todo lo editable por el negocio vive acá (datos de contacto, WhatsApp,
 * horarios y reglas de pedido). Se puede sobreescribir por variables de entorno.
 */

export const shopConfig = {
  name: "Afrikísima",
  tagline: "Pastelería artesanal",
  city: "Bahía Blanca",
  /** Número en formato internacional sin "+" ni espacios. */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5492915000000",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "afrikisima",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hola@afrikisima.com",
  currency: "ARS",
  currencySymbol: "$",
  /** Días mínimos de anticipación para encargar. */
  leadTimeDays: 2,
  pickupAddress: "Bahía Blanca, Buenos Aires",
  schedule: [
    { day: "Lunes a viernes", hours: "9:00 – 19:00" },
    { day: "Sábados", hours: "9:00 – 14:00" },
    { day: "Domingos", hours: "Cerrado" },
  ],
  fulfillment: [
    { id: "retiro", label: "Retiro en local" },
    { id: "envio", label: "Envío a domicilio (a coordinar)" },
  ],
} as const;

export type FulfillmentId = (typeof shopConfig.fulfillment)[number]["id"];
