import ExcelJS from "exceljs";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const currencyFormat = '"$"#,##0.00';
const numberFormat = "#,##0.000";
const percentFormat = "0.00";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Supabase no está configurado", { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sesión requerida", { status: 401 });

  const { data: allowed, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || !allowed) return new Response("Acceso denegado", { status: 403 });

  const [budgetsResult, productsResult, itemsResult, suppliesResult, historyResult] =
    await Promise.all([
      supabase.from("recipe_budget_summary").select("*").order("created_at"),
      supabase.from("product_costs").select("*").order("product_name"),
      supabase.from("recipe_items_admin").select("*").order("recipe_name"),
      supabase.from("current_ingredient_costs").select("*").order("name"),
      supabase.from("ingredient_prices").select("*").order("recorded_at", { ascending: false }),
    ]);

  const queryError =
    budgetsResult.error ??
    productsResult.error ??
    itemsResult.error ??
    suppliesResult.error ??
    historyResult.error;
  if (queryError) return new Response(`No se pudo generar el Excel: ${queryError.message}`, { status: 500 });

  const budgets = budgetsResult.data ?? [];
  const products = productsResult.data ?? [];
  const items = itemsResult.data ?? [];
  const supplies = suppliesResult.data ?? [];
  const history = historyResult.data ?? [];
  const suppliesById = new Map(supplies.map((supply) => [supply.id, supply]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Afrikísima";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Exportación de tortas, recetas, insumos y precios";

  const cakesSheet = workbook.addWorksheet("Tortas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  cakesSheet.columns = [
    { header: "Tipo", key: "type", width: 18 },
    { header: "Torta", key: "cake", width: 30 },
    { header: "Variante", key: "variant", width: 24 },
    { header: "Cliente", key: "customer", width: 24 },
    { header: "Fecha del evento", key: "eventDate", width: 18, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Molde", key: "mold", width: 16 },
    { header: "Presentación", key: "presentation", width: 30 },
    { header: "Rendimiento (cantidad de productos producidos)", key: "yield", width: 22, style: { numFmt: numberFormat } },
    { header: "Porciones", key: "servings", width: 12, style: { numFmt: "#,##0" } },
    { header: "Costo conocido de insumos", key: "knownSupplyCost", width: 22, style: { numFmt: currencyFormat } },
    { header: "Costo de insumos", key: "supplyCost", width: 18, style: { numFmt: currencyFormat } },
    { header: "Insumos sin precio", key: "missingPrices", width: 18, style: { numFmt: "#,##0" } },
    { header: "Costo total", key: "totalCost", width: 16, style: { numFmt: currencyFormat } },
    { header: "Margen objetivo %", key: "margin", width: 18, style: { numFmt: percentFormat } },
    { header: "Redondeo", key: "rounding", width: 14, style: { numFmt: currencyFormat } },
    { header: "Precio publicado/ofrecido", key: "published", width: 22, style: { numFmt: currencyFormat } },
    { header: "Sugerido antes de redondear", key: "unroundedSuggested", width: 24, style: { numFmt: currencyFormat } },
    { header: "Precio sugerido", key: "suggested", width: 18, style: { numFmt: currencyFormat } },
    { header: "Costo por porción", key: "costPerServing", width: 18, style: { numFmt: currencyFormat } },
    { header: "Sugerido por porción", key: "suggestedPerServing", width: 20, style: { numFmt: currencyFormat } },
    { header: "Estado", key: "status", width: 14 },
    { header: "Notas", key: "notes", width: 35 },
  ];

  for (const product of products) {
    cakesSheet.addRow({
      type: "Catálogo",
      cake: product.product_name,
      variant: product.variant_label,
      yield: toNumber(product.yield_quantity),
      servings: toNumber(product.servings),
      knownSupplyCost: toNumber(product.known_supply_cost),
      supplyCost: toNumber(product.ingredient_batch_cost),
      missingPrices: toNumber(product.missing_price_count),
      totalCost: toNumber(product.total_cost),
      margin: toNumber(product.target_margin_percent),
      rounding: toNumber(product.rounding_increment),
      published: toNumber(product.published_price),
      unroundedSuggested: toNumber(product.unrounded_suggested_price),
      suggested: toNumber(product.suggested_price),
      costPerServing: toNumber(product.cost_per_serving),
      suggestedPerServing: toNumber(product.suggested_price_per_serving),
      status: "Publicado",
    });
  }

  for (const budget of budgets.filter((row) => row.variant_id === null)) {
    cakesSheet.addRow({
      type: "Personalizada",
      cake: budget.name,
      customer: budget.customer_name,
      eventDate: toDate(budget.event_date),
      mold: budget.mold_size,
      presentation: budget.presentation,
      yield: toNumber(budget.yield_quantity),
      servings: toNumber(budget.servings),
      knownSupplyCost: toNumber(budget.known_supply_cost),
      supplyCost: toNumber(budget.supply_cost),
      missingPrices: toNumber(budget.missing_price_count),
      totalCost: toNumber(budget.total_cost),
      margin: toNumber(budget.target_margin_percent),
      rounding: toNumber(budget.rounding_increment),
      published: toNumber(budget.quoted_price),
      unroundedSuggested: toNumber(budget.unrounded_suggested_price),
      suggested: toNumber(budget.suggested_price),
      costPerServing: toNumber(budget.cost_per_serving),
      suggestedPerServing: toNumber(budget.suggested_price_per_serving),
      status: translateStatus(budget.status),
      notes: budget.notes,
    });
  }
  finishSheet(cakesSheet);

  const detailSheet = workbook.addWorksheet("Detalle de recetas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  detailSheet.columns = [
    { header: "Torta", key: "cake", width: 30 },
    { header: "Variante", key: "variant", width: 22 },
    { header: "Sección", key: "section", width: 18 },
    { header: "Tipo de insumo", key: "type", width: 18 },
    { header: "Insumo", key: "supply", width: 28 },
    { header: "Tamaño", key: "size", width: 20 },
    { header: "Cantidad usada", key: "quantity", width: 16, style: { numFmt: numberFormat } },
    { header: "Unidad", key: "unit", width: 12 },
    { header: "Detalle de cantidad", key: "note", width: 24 },
    { header: "Costo unitario", key: "unitCost", width: 17, style: { numFmt: currencyFormat } },
    { header: "Cálculo", key: "calculation", width: 34 },
    { header: "Costo del insumo", key: "lineCost", width: 18, style: { numFmt: currencyFormat } },
  ];
  for (const item of items) {
    const supply = suppliesById.get(item.ingredient_id);
    detailSheet.addRow({
      cake: item.recipe_name,
      variant: item.variant_id,
      section: item.section_name,
      type: item.supply_type === "packaging" ? "Packaging" : "Ingrediente",
      supply: item.ingredient_name,
      size: item.size_label,
      quantity: toNumber(item.quantity),
      unit: item.supply_type === "packaging" ? "unidad" : item.base_unit,
      note: item.quantity_note,
      unitCost: toNumber(item.effective_unit_cost ?? supply?.effective_unit_cost),
      calculation:
        item.effective_unit_cost === null || item.effective_unit_cost === undefined
          ? "Sin precio vigente"
          : `${item.quantity} × ${item.effective_unit_cost}`,
      lineCost: toNumber(item.line_cost),
    });
  }
  finishSheet(detailSheet);

  const suppliesSheet = workbook.addWorksheet("Insumos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  suppliesSheet.columns = [
    { header: "Insumo", key: "name", width: 30 },
    { header: "Tipo", key: "type", width: 16 },
    { header: "Tamaño", key: "size", width: 22 },
    { header: "Unidad usada", key: "baseUnit", width: 15 },
    { header: "Unidad de compra", key: "purchaseUnit", width: 18 },
    { header: "Contenido comprado", key: "packageQuantity", width: 19, style: { numFmt: numberFormat } },
    { header: "Conversión a unidad usada", key: "conversion", width: 24, style: { numFmt: numberFormat } },
    { header: "Precio actual", key: "price", width: 16, style: { numFmt: currencyFormat } },
    { header: "Costo unitario", key: "unitCost", width: 17, style: { numFmt: currencyFormat } },
    { header: "Variación %", key: "change", width: 14, style: { numFmt: percentFormat } },
    { header: "Marca", key: "brand", width: 20 },
    { header: "Proveedor", key: "supplier", width: 24 },
    { header: "Fecha del precio", key: "recordedAt", width: 17, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Actualización", key: "updateMode", width: 16 },
    { header: "Fuente", key: "sourceUrl", width: 45 },
    { header: "Última sincronización", key: "lastSyncAt", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Estado de sincronización", key: "syncStatus", width: 24 },
    { header: "Detalle de sincronización", key: "syncMessage", width: 42 },
  ];
  for (const supply of supplies) {
    suppliesSheet.addRow({
      name: supply.name,
      type: supply.supply_type === "packaging" ? "Packaging" : "Ingrediente",
      size: supply.size_label,
      baseUnit: supply.base_unit,
      purchaseUnit: supply.purchase_unit,
      packageQuantity: toNumber(supply.package_quantity),
      conversion: toNumber(supply.conversion_to_base),
      price: toNumber(supply.package_price),
      unitCost: toNumber(supply.effective_unit_cost),
      change: toNumber(supply.price_change_percent),
      brand: supply.brand,
      supplier: supply.supplier,
      recordedAt: toDate(supply.recorded_at),
      updateMode: supply.auto_update_enabled ? "Automática" : "Manual",
      sourceUrl: supply.source_url,
      lastSyncAt: toDateTime(supply.last_price_sync_at),
      syncStatus: translateSyncStatus(supply.last_price_sync_status),
      syncMessage: supply.last_price_sync_message ?? supply.source_notes,
    });
  }
  finishSheet(suppliesSheet);

  const historySheet = workbook.addWorksheet("Historial de precios", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  historySheet.columns = [
    { header: "Insumo", key: "name", width: 30 },
    { header: "Tipo", key: "type", width: 16 },
    { header: "Fecha", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Marca", key: "brand", width: 20 },
    { header: "Proveedor", key: "supplier", width: 24 },
    { header: "Contenido comprado", key: "quantity", width: 19, style: { numFmt: numberFormat } },
    { header: "Unidad de compra", key: "purchaseUnit", width: 18 },
    { header: "Conversión", key: "conversion", width: 14, style: { numFmt: numberFormat } },
    { header: "Precio", key: "price", width: 16, style: { numFmt: currencyFormat } },
    { header: "Costo unitario", key: "unitCost", width: 17, style: { numFmt: currencyFormat } },
  ];
  for (const price of history) {
    const supply = suppliesById.get(price.ingredient_id);
    const quantity = toNumber(price.package_quantity);
    const conversion = toNumber(price.conversion_to_base);
    const priceValue = toNumber(price.package_price);
    historySheet.addRow({
      name: supply?.name ?? "Insumo eliminado",
      type: supply?.supply_type === "packaging" ? "Packaging" : "Ingrediente",
      date: toDate(price.recorded_at),
      brand: price.brand,
      supplier: price.supplier,
      quantity,
      purchaseUnit: price.purchase_unit,
      conversion,
      price: priceValue,
      unitCost:
        quantity !== null && conversion !== null && priceValue !== null
          ? priceValue / (quantity * conversion)
          : null,
    });
  }
  finishSheet(historySheet);

  const file = await workbook.xlsx.writeBuffer();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="afrikisima-${today}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function finishSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.height = 32;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B3F2A" } };

  if (sheet.rowCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F2EA" } };
    }
    row.alignment = { vertical: "top", wrapText: true };
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateTime(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function translateStatus(status: unknown) {
  const values: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    accepted: "Aceptado",
    cancelled: "Cancelado",
  };
  return values[String(status)] ?? String(status ?? "");
}

function translateSyncStatus(status: unknown) {
  const values: Record<string, string> = {
    ok: "Precio actualizado",
    unchanged: "Sin cambios",
    error: "Error",
  };
  return values[String(status)] ?? "Pendiente";
}
