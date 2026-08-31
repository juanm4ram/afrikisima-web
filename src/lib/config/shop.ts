/**
 * Configuración de la tienda Afrikísima.
 * Todo lo editable por el negocio vive acá (datos de contacto, WhatsApp y
 * reglas de pedido). Se puede sobreescribir por variables de entorno.
 */

export const shopConfig = {
  name: "Afrikísima",
  tagline: "Pastelería artesanal",
  city: "Tres de Febrero",
  /** Número en formato internacional sin "+" ni espacios. */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5491158377972",
  /** El mismo número, formateado para mostrar. */
  phoneDisplay: "+54 9 11 5837-7972",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "afrikisima_",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK ?? "afrikisima",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "afrikisima@gmail.com",
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
