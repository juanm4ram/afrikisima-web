import type { Metadata } from "next";

// Tipografías autoalojadas (sin depender de Google Fonts en build ni en runtime).
import "@fontsource-variable/jost";
import "@fontsource-variable/playfair-display";
import "@/styles/globals.css";

import { SiteShell } from "@/components/layout/site-shell";
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
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
