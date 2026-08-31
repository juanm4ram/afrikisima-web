import type { Metadata } from "next";

// Tipografías autoalojadas (sin depender de Google Fonts en build ni en runtime).
import "@fontsource-variable/jost";
import "@fontsource-variable/playfair-display";
import "@/styles/globals.css";

import { CartProvider, CartSheet } from "@/features/cart";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsappFab } from "@/components/layout/whatsapp-fab";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { shopConfig } from "@/lib/config/shop";


export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: `${shopConfig.name} — ${shopConfig.tagline}`,
  description:
    "Tortas, tartas y cookies artesanales. Elegí tu tamaño y encargá por WhatsApp.",
  openGraph: {
    title: `${shopConfig.name} — ${shopConfig.tagline}`,
    description:
      "Tortas, tartas y cookies artesanales. Elegí tu tamaño y encargá por WhatsApp.",
    images: [{ url: "/backgrounds/hero.webp", width: 2400, height: 1000 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body className="antialiased">
        <ErrorBoundary>
          <CartProvider>
            <SiteHeader />
            {children}
            <CartSheet />
            <WhatsappFab />
            <Toaster position="top-center" />
          </CartProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
