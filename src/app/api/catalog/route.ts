import { NextResponse } from "next/server";

import { CRAVEUP_PUBLIC_API_KEY, STORE_FRONT_API_BASE_URL, location_Id } from "@/lib/config/storefront";
import { getCatalog } from "@/features/catalog/data/products";

/**
 * Catálogo de la tienda.
 *
 * Mantiene la lógica del starter: si hay un proveedor de storefront
 * configurado (API key + location) se consulta ahí; si no, se responde con el
 * catálogo local de Afrikísima. Así el front siempre consume el mismo contrato.
 */
export async function GET() {
  const apiKey = CRAVEUP_PUBLIC_API_KEY;

  if (!apiKey || !location_Id) {
    return NextResponse.json(getCatalog(), {
      headers: { "x-afrikisima-source": "local-catalog" },
    });
  }

  try {
    const response = await fetch(
      `${STORE_FRONT_API_BASE_URL}/api/v1/locations/${location_Id}/products`,
      {
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json(getCatalog(), {
        headers: { "x-afrikisima-source": "local-catalog-fallback" },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { "x-afrikisima-source": "storefront-api" },
    });
  } catch {
    return NextResponse.json(getCatalog(), {
      headers: { "x-afrikisima-source": "local-catalog-fallback" },
    });
  }
}
