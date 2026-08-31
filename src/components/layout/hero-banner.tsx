import Image from "next/image";

/**
 * Portada: sólo imagen de fondo + logo. Sin texto de presentación,
 * el catálogo arranca inmediatamente debajo.
 */
export function HeroBanner() {
  return (
    <section className="relative h-[52vh] min-h-[320px] w-full overflow-hidden sm:h-[62vh] sm:min-h-[420px]">
      <Image
        src="/backgrounds/hero.webp"
        alt="Torta con buttercream pastel de Afrikísima"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#fdf7f2]/55 via-[#fdf7f2]/30 to-[#fdf7f2]" />

      <div className="relative flex h-full items-center justify-center px-6">
        <Image
          src="/brand/logo.svg"
          alt="Afrikísima"
          width={1890}
          height={581}
          priority
          className="w-[min(76vw,600px)] drop-shadow-[0_3px_18px_rgba(253,247,242,0.95)]"
        />
      </div>
    </section>
  );
}
