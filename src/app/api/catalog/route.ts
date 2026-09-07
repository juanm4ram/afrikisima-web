import { NextResponse } from "next/server";

import { loadCatalog } from "@/features/catalog/data/catalog-repository";

/**
 * Catálogo de la tienda.
 *
 * Supabase es la fuente principal cuando está configurado. Durante la migración
 * el catálogo local sigue disponible como respaldo.
 */
export async function GET() {
  const { source, ...catalog } = await loadCatalog();
  return NextResponse.json(catalog, {
    headers: { "x-afrikisima-source": source },
  });
}
