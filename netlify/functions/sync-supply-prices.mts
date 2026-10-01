interface SyncTarget {
  id: string;
  name: string;
  source_type: "carrefour_vtex" | "valentino_html";
  source_product_id: string | null;
  source_url: string | null;
  package_quantity: number | string;
  package_price: number | string;
  supplier: string | null;
  brand: string | null;
  purchase_unit: string;
  conversion_to_base: number | string;
}

interface SyncResult {
  name: string;
  status: "ok" | "unchanged" | "error";
  message: string;
}

export default async function () {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para sincronizar precios.",
    );
  }

  const targets = await supabaseRequest<SyncTarget[]>(
    supabaseUrl,
    serviceRoleKey,
    "/rest/v1/current_ingredient_costs" +
      "?select=id,name,source_type,source_product_id,source_url,package_quantity," +
      "package_price,supplier,brand,purchase_unit,conversion_to_base" +
      "&auto_update_enabled=eq.true",
  );

  const results = await mapWithConcurrency(targets, 5, async (target) => {
    try {
      const newPrice = await fetchSourcePrice(target);
      const currentPrice = Number(target.package_price);

      if (!Number.isFinite(newPrice) || newPrice <= 0) {
        throw new Error("La fuente no devolvió un precio válido.");
      }

      if (Math.abs(newPrice - currentPrice) < 0.005) {
        const result: SyncResult = {
          name: target.name,
          status: "unchanged",
          message: `Sin cambios: $${newPrice.toFixed(2)}`,
        };
        await recordSyncStatus(supabaseUrl, serviceRoleKey, target.id, result);
        return result;
      }

      await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/ingredient_prices",
        {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            ingredient_id: target.id,
            package_quantity: Number(target.package_quantity),
            package_price: newPrice,
            supplier: target.supplier,
            brand: target.brand,
            purchase_unit: target.purchase_unit,
            conversion_to_base: Number(target.conversion_to_base),
            recorded_at: argentinaDate(),
          }),
        },
      );

      const result: SyncResult = {
        name: target.name,
        status: "ok",
        message: `Precio actualizado: $${currentPrice.toFixed(2)} → $${newPrice.toFixed(2)}`,
      };
      await recordSyncStatus(supabaseUrl, serviceRoleKey, target.id, result);
      return result;
    } catch (error) {
      const result: SyncResult = {
        name: target.name,
        status: "error",
        message: error instanceof Error ? error.message.slice(0, 500) : "Error desconocido",
      };
      await recordSyncStatus(supabaseUrl, serviceRoleKey, target.id, result);
      return result;
    }
  });

  const updated = results.filter((result) => result.status === "ok").length;
  const unchanged = results.filter((result) => result.status === "unchanged").length;
  const failed = results.filter((result) => result.status === "error");

  console.log(
    JSON.stringify({
      checked: results.length,
      updated,
      unchanged,
      failed: failed.length,
      errors: failed,
    }),
  );

  if (failed.length === results.length && results.length > 0) {
    throw new Error("Fallaron todas las fuentes automáticas de precios.");
  }
}

async function fetchSourcePrice(target: SyncTarget) {
  if (target.source_type === "carrefour_vtex") {
    if (!target.source_product_id) throw new Error("Falta el identificador de Carrefour.");
    const endpoint =
      "https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=productId:" +
      encodeURIComponent(target.source_product_id);
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": "AfrikisimaPriceSync/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Carrefour respondió HTTP ${response.status}.`);

    const raw: unknown = await response.json();
    const products = typeof raw === "string" ? JSON.parse(raw) : raw;
    const product = Array.isArray(products) ? products[0] : null;
    const sellers = product?.items?.[0]?.sellers ?? [];
    const seller = sellers.find((candidate: { sellerDefault?: boolean }) => candidate.sellerDefault) ?? sellers[0];
    const offer = seller?.commertialOffer;
    const listPrice = Number(offer?.ListPrice);
    const sellingPrice = Number(offer?.Price);

    // Para calcular costos se prioriza el precio regular y no una promoción transitoria.
    return listPrice > 0 ? listPrice : sellingPrice;
  }

  if (target.source_type === "valentino_html") {
    if (!target.source_url) throw new Error("Falta la URL de Valentino.");
    const response = await fetch(target.source_url, {
      headers: { accept: "text/html", "user-agent": "AfrikisimaPriceSync/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Valentino respondió HTTP ${response.status}.`);
    const html = await response.text();
    const priceMeta = html.match(
      /<meta[^>]+property=["']product:price:amount["'][^>]*>/i,
    )?.[0];
    const rawPrice = priceMeta?.match(/content=["']([0-9.]+)["']/i)?.[1];
    const price = Number(rawPrice);
    if (!Number.isFinite(price)) throw new Error("No se encontró el precio en la página de Valentino.");
    return price;
  }

  throw new Error("Tipo de fuente no compatible.");
}

async function recordSyncStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  ingredientId: string,
  result: SyncResult,
) {
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/rest/v1/ingredients?id=eq.${encodeURIComponent(ingredientId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        last_price_sync_at: new Date().toISOString(),
        last_price_sync_status: result.status,
        last_price_sync_message: result.message,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function supabaseRequest<T = unknown>(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(supabaseUrl + path, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase respondió HTTP ${response.status}: ${detail}`);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function argentinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
