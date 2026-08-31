import Image from "next/image";
import { Instagram, Mail, MapPin, Music2 } from "lucide-react";

import { shopConfig } from "@/lib/config/shop";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/60">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6">
        <div className="space-y-3">
          <Image
            src="/brand/logo.svg"
            alt="Afrikísima"
            width={1890}
            height={581}
            className="h-8 w-auto"
          />
          <p className="text-sm text-muted-foreground">
            {shopConfig.tagline} · {shopConfig.city}
          </p>
        </div>

        <div className="space-y-2 text-sm sm:justify-self-end">
          <p className="eyebrow">Contacto</p>
          <a
            href={`mailto:${shopConfig.email}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <Mail className="size-3.5" /> {shopConfig.email}
          </a>
          <a
            href={`https://instagram.com/${shopConfig.instagram}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <Instagram className="size-3.5" /> @{shopConfig.instagram}
          </a>
          <a
            href={`https://tiktok.com/@${shopConfig.tiktok}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <Music2 className="size-3.5" /> @{shopConfig.tiktok}
          </a>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-3.5" /> {shopConfig.location}
          </p>
        </div>
      </div>

      <div className="border-t border-border/70 px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {shopConfig.name}. Precios y tamaños de referencia.
      </div>
    </footer>
  );
}
