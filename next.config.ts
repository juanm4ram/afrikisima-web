import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Todas las fotos son locales (public/). Si más adelante se sirven desde un
    // CDN, agregar acá el hostname en `remotePatterns`.
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
