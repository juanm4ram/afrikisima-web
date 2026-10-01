import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Supabase no está configurado", { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sesión requerida", { status: 401 });

  const { data: allowed, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || !allowed) return new Response("Acceso denegado", { status: 403 });

  const type = new URL(request.url).searchParams.get("type") ?? "recipes";
  if (type === "supplies") return exportSupplies(supabase);
  if (type === "recipes") return exportRecipes(supabase);
  return new Response("Tipo de exportación inválido", { status: 400 });
}

async function exportRecipes(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  if (!supabase) return new Response("Supabase no está configurado", { status: 503 });

  const [productsResult, itemsResult] = await Promise.all([
    supabase.from("product_costs").select("*").order("product_name"),
    supabase.from("recipe_items_admin").select("*").order("section_sort_order"),
  ]);
  const error = productsResult.error ?? itemsResult.error;
  if (error) return new Response(`No se pudo generar el CSV: ${error.message}`, { status: 500 });

  const products = productsResult.data ?? [];
  const items = itemsResult.data ?? [];
  const rows: unknown[][] = [[
    "Torta",
    "Variante",
    "Sección",
    "Insumo",
    "Tipo",
    "Cantidad usada",
    "Unidad",
    "Detalle de cantidad",
    "Precio de compra actual",
    "Contenido comprado",
    "Unidad de compra",
    "Costo unitario actual",
    "Costo del insumo",
    "Costo conocido del lote",
    "Insumos sin precio",
    "Rendimiento (cantidad de productos producidos)",
    "Costo completo de la receta",
    "Margen objetivo %",
    "Precio antes de redondear",
    "Redondeo",
    "Precio sugerido",
    "Precio publicado",
    "Porciones",
    "Costo por porción",
    "Sugerido por porción",
    "Notas de la receta",
  ]];

  for (const product of products) {
    const recipeItems = items.filter((item) => item.variant_id === product.variant_id);
    const outputItems = recipeItems.length > 0 ? recipeItems : [null];
    for (const item of outputItems) {
      rows.push([
        product.product_name,
        product.variant_label,
        item?.section_name,
        item?.ingredient_name,
        item ? (item.supply_type === "packaging" ? "Packaging" : "Ingrediente") : null,
        item?.quantity,
        item ? (item.supply_type === "packaging" ? "unidad" : item.base_unit) : null,
        item?.quantity_note,
        item?.package_price,
        item?.package_quantity,
        item?.purchase_unit,
        item?.effective_unit_cost,
        item?.line_cost,
        product.known_supply_cost,
        product.missing_price_count,
        product.yield_quantity,
        product.total_cost,
        product.target_margin_percent,
        product.unrounded_suggested_price,
        product.rounding_increment,
        product.suggested_price,
        product.published_price,
        product.servings,
        product.cost_per_serving,
        product.suggested_price_per_serving,
        product.notes,
      ]);
    }
  }

  return csvResponse(rows, `afrikisima-recetas-${argentinaDate()}.csv`);
}

async function exportSupplies(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  if (!supabase) return new Response("Supabase no está configurado", { status: 503 });

  const { data, error } = await supabase
    .from("current_ingredient_costs")
    .select("*")
    .order("name");
  if (error) return new Response(`No se pudo generar el CSV: ${error.message}`, { status: 500 });

  const rows: unknown[][] = [[
    "Insumo",
    "Tipo",
    "Tamaño",
    "Unidad usada",
    "Unidad de compra",
    "Contenido comprado",
    "Conversión a unidad usada",
    "Precio actual",
    "Costo unitario",
    "Variación %",
    "Marca",
    "Proveedor",
    "Fecha del precio",
    "Actualización",
    "Fuente",
    "Última sincronización",
    "Estado de sincronización",
    "Detalle",
  ]];

  for (const supply of data ?? []) {
    rows.push([
      supply.name,
      supply.supply_type === "packaging" ? "Packaging" : "Ingrediente",
      supply.size_label,
      supply.base_unit,
      supply.purchase_unit,
      supply.package_quantity,
      supply.conversion_to_base,
      supply.package_price,
      supply.effective_unit_cost,
      supply.price_change_percent,
      supply.brand,
      supply.supplier,
      supply.recorded_at,
      supply.auto_update_enabled ? "Automática" : "Manual",
      supply.source_url,
      supply.last_price_sync_at,
      supply.last_price_sync_status,
      supply.last_price_sync_message ?? supply.source_notes,
    ]);
  }

  return csvResponse(rows, `afrikisima-insumos-${argentinaDate()}.csv`);
}

function csvResponse(rows: unknown[][], filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function argentinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
