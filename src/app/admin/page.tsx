import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addCatalogRecipeItem,
  deleteRecipeItem,
  publishSuggestedPrice,
  publishSuggestedPrices,
  recordIngredientPrice,
  updateCatalogRecipeItem,
  updateRecipeSettings,
} from "./actions";
import { LogoutButton } from "./logout-button";
import { SupplyForm } from "./supply-form";

export const dynamic = "force-dynamic";

interface IngredientCost {
  id: string;
  name: string;
  base_unit: string;
  supply_type: "ingredient" | "packaging";
  size_label: string | null;
  package_quantity: number | string | null;
  package_price: number | string | null;
  purchase_unit: string | null;
  conversion_to_base: number | string | null;
  brand: string | null;
  supplier: string | null;
  effective_unit_cost: number | string | null;
  price_change_percent: number | string | null;
  source_url: string | null;
  auto_update_enabled: boolean;
  last_price_sync_at: string | null;
  last_price_sync_status: "ok" | "unchanged" | "error" | null;
  last_price_sync_message: string | null;
}

interface ProductCost {
  variant_id: string;
  product_name: string;
  variant_label: string;
  published_price: number | string;
  recipe_id: string | null;
  item_count: number | string | null;
  priced_item_count: number | string | null;
  missing_price_count: number | string | null;
  known_supply_cost: number | string | null;
  suggested_price: number | string | null;
  unrounded_suggested_price: number | string | null;
  yield_quantity: number | string | null;
  target_margin_percent: number | string | null;
  rounding_increment: number | string | null;
  total_cost: number | string | null;
  servings: number | string | null;
  cost_per_serving: number | string | null;
  suggested_price_per_serving: number | string | null;
  notes: string | null;
}

interface RecipeItem {
  id: string;
  recipe_id: string;
  variant_id: string;
  section_id: string;
  section_name: string;
  section_sort_order: number;
  ingredient_id: string;
  ingredient_name: string;
  base_unit: string;
  supply_type: "ingredient" | "packaging";
  size_label: string | null;
  quantity: number | string;
  quantity_note: string | null;
  package_quantity: number | string | null;
  package_price: number | string | null;
  purchase_unit: string | null;
  effective_unit_cost: number | string | null;
  price_recorded_at: string | null;
  line_cost: number | string | null;
}

interface RecipeSection {
  id: string;
  recipe_id: string;
  name: string;
  sort_order: number;
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/login");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");

  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-3 text-3xl">Cuenta sin autorización</h1>
        <p className="mb-6 text-muted-foreground">
          El usuario está autenticado, pero todavía no fue agregado a app_admins.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/admin/export">Descargar Excel</a>
          </Button>
          <LogoutButton />
        </div>
      </main>
    );
  }

  const [
    { data: ingredients },
    { data: productCosts },
    { data: recipeItems },
    { data: recipeSections },
  ] =
    await Promise.all([
    supabase.from("current_ingredient_costs").select("*").order("name"),
    supabase.from("product_costs").select("*").order("product_name"),
    supabase.from("recipe_items_admin").select("*").order("ingredient_name"),
    supabase.from("recipe_sections").select("id,recipe_id,name,sort_order").order("sort_order"),
  ]);
  const ingredientRows = (ingredients ?? []) as IngredientCost[];
  const productRows = (productCosts ?? []) as ProductCost[];
  const recipeItemRows = (recipeItems ?? []) as RecipeItem[];
  const recipeSectionRows = (recipeSections ?? []) as RecipeSection[];
  const publishableCount = productRows.filter((row) => row.suggested_price !== null).length;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administración</p>
          <h1 className="text-4xl">Insumos y precios</h1>
          <p className="mt-2 text-muted-foreground">Sesión: {auth.user.email}</p>
          <Link href="/admin/presupuestos" className="mt-3 inline-block text-sm underline">
            Abrir presupuestos personalizados
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/admin/export">Descargar Excel</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/admin/export/csv?type=recipes">Recetas CSV</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/admin/export/csv?type=supplies">Insumos CSV</a>
          </Button>
          <LogoutButton />
        </div>
      </header>

      <SupplyForm />

      <section className="mb-10 overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-muted/20 p-5">
          <div>
            <span className="mb-2 inline-flex rounded-md border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hoja 1 · Insumos
            </span>
            <h2 className="text-2xl">Lista de insumos</h2>
            <p className="text-sm text-muted-foreground">
              Editá las celdas y guardá la fila. Cada actualización conserva el precio anterior.
            </p>
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
            {ingredientRows.length} filas
          </span>
        </div>
        {ingredientRows.length === 0 ? (
          <p className="p-6 text-muted-foreground">Todavía no hay insumos cargados.</p>
        ) : (
          <div className="max-h-[680px] overflow-auto">
            <table className="w-full min-w-[1580px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#f3eee5] text-[10px] uppercase tracking-wide text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                <tr>
                  <SheetHeader className="sticky left-0 z-30 w-12 text-center">#</SheetHeader>
                  <SheetHeader className="sticky left-12 z-30 min-w-[210px]">Insumo</SheetHeader>
                  <SheetHeader className="min-w-[125px]">Tipo</SheetHeader>
                  <SheetHeader className="min-w-[145px]">Marca</SheetHeader>
                  <SheetHeader className="min-w-[160px]">Proveedor</SheetHeader>
                  <SheetHeader className="min-w-[105px] text-right">Contenido</SheetHeader>
                  <SheetHeader className="min-w-[120px]">Unidad compra</SheetHeader>
                  <SheetHeader className="min-w-[105px] text-right">Conversión</SheetHeader>
                  <SheetHeader className="min-w-[120px] text-right">Precio actual</SheetHeader>
                  <SheetHeader className="min-w-[125px] text-right">Costo unit.</SheetHeader>
                  <SheetHeader className="min-w-[90px] text-right">Variación</SheetHeader>
                  <SheetHeader className="min-w-[125px]">Nuevo precio</SheetHeader>
                  <SheetHeader className="min-w-[105px] text-center">Acción</SheetHeader>
                </tr>
              </thead>
              <tbody>
                {ingredientRows.map((row, index) => {
                  const formId = `supply-${row.id}`;
                  const isPackaging = row.supply_type === "packaging";
                  return (
                    <tr key={row.id} className="group odd:bg-white even:bg-[#fcfaf6] hover:bg-[#fff7e8]">
                      <SheetCell className="sticky left-0 z-10 bg-inherit text-center font-mono text-[10px] text-muted-foreground">
                        {index + 1}
                      </SheetCell>
                      <SheetCell className="sticky left-12 z-10 bg-inherit font-medium">
                        {row.name}
                        {row.size_label && <span className="block font-normal text-muted-foreground">{row.size_label}</span>}
                        {row.source_url && (
                          <a href={row.source_url} target="_blank" rel="noreferrer" className="block text-[10px] font-normal underline">
                            Abrir fuente
                          </a>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
                          {isPackaging ? "Packaging" : "Ingrediente"}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {row.auto_update_enabled ? "Automático" : "Manual"}
                        </span>
                        {row.last_price_sync_at && (
                          <span
                            className={row.last_price_sync_status === "error" ? "block text-[10px] text-destructive" : "block text-[10px] text-muted-foreground"}
                            title={row.last_price_sync_message ?? undefined}
                          >
                            {row.last_price_sync_status === "error" ? "Error al sincronizar" : formatSyncDate(row.last_price_sync_at)}
                          </span>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} name="brand" defaultValue={row.brand ?? ""} placeholder="Marca" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} name="supplier" defaultValue={row.supplier ?? ""} placeholder="Proveedor" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                      </SheetCell>
                      <SheetCell className="text-right">
                        {isPackaging ? (
                          <>
                            <span>{row.size_label ?? "1 unidad"}</span>
                            <input form={formId} type="hidden" name="package_quantity" value="1" />
                          </>
                        ) : (
                          <Input form={formId} aria-label={`Contenido de ${row.name}`} name="package_quantity" type="number" min="0.01" step="0.01" defaultValue={row.package_quantity ?? ""} className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                        )}
                      </SheetCell>
                      <SheetCell>
                        {isPackaging ? (
                          <><span>unidad</span><input form={formId} type="hidden" name="purchase_unit" value="unit" /></>
                        ) : (
                          <PurchaseUnitSelect form={formId} defaultValue={row.purchase_unit ?? row.base_unit} compact />
                        )}
                      </SheetCell>
                      <SheetCell className="text-right">
                        {isPackaging ? (
                          <><span>1</span><input form={formId} type="hidden" name="conversion_to_base" value="1" /></>
                        ) : (
                          <Input form={formId} aria-label={`Conversión de ${row.name}`} name="conversion_to_base" type="number" min="0.001" step="0.001" defaultValue={row.conversion_to_base ?? ""} className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                        )}
                      </SheetCell>
                      <SheetCell className="text-right font-medium tabular-nums">
                        {formatNullablePrice(row.package_price)}
                      </SheetCell>
                      <SheetCell className="text-right tabular-nums">
                        {row.effective_unit_cost === null ? "—" : `$${Number(row.effective_unit_cost).toFixed(2)} / ${row.base_unit}`}
                      </SheetCell>
                      <SheetCell className={Number(row.price_change_percent ?? 0) > 0 ? "text-right font-medium text-destructive" : "text-right font-medium text-emerald-700"}>
                        {row.price_change_percent === null ? "—" : `${Number(row.price_change_percent) >= 0 ? "+" : ""}${Number(row.price_change_percent).toFixed(1)}%`}
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} aria-label={`Nuevo precio de ${row.name}`} name="package_price" type="number" min="0" step="0.01" placeholder="$ 0,00" className="h-8 bg-white text-right tabular-nums" required />
                      </SheetCell>
                      <SheetCell className="text-center">
                        <form id={formId} action={recordIngredientPrice}>
                          <input type="hidden" name="ingredient_id" value={row.id} />
                          <input type="hidden" name="base_unit" value={row.base_unit} />
                          <Button type="submit" size="sm" className="h-7 px-2">Guardar</Button>
                        </form>
                      </SheetCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-muted/20 p-5">
          <div>
            <span className="mb-2 inline-flex rounded-md border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hoja 2 · Productos y recetas
            </span>
            <h2 className="text-2xl">Productos, recetas y precios</h2>
            <p className="text-sm text-muted-foreground">
              Cada fila es una receta. Abrila para editar sus celdas y ver el cálculo completo.
            </p>
          </div>
          <form action={publishSuggestedPrices}>
            <Button type="submit" disabled={publishableCount === 0}>
              Publicar {publishableCount || ""} precios
            </Button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[52px_minmax(260px,1.5fr)_150px_145px_145px_145px_135px_48px] border-b bg-[#f3eee5] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="border-r px-3 py-3 text-center">#</div>
              <div className="border-r px-3 py-3">Producto / variante</div>
              <div className="border-r px-3 py-3 text-right">Costo insumos</div>
              <div className="border-r px-3 py-3 text-right">Costo receta</div>
              <div className="border-r px-3 py-3 text-right">Sugerido</div>
              <div className="border-r px-3 py-3 text-right">Publicado</div>
              <div className="border-r px-3 py-3 text-center">Estado</div>
              <div className="px-3 py-3" aria-hidden="true" />
            </div>

            {productRows.map((row, productIndex) => {
              const items = recipeItemRows.filter((item) => item.variant_id === row.variant_id);
              const sections = recipeSectionRows.filter((section) => section.recipe_id === row.recipe_id);
              const missingPriceCount = Number(row.missing_price_count ?? 0);
              const hasItems = Number(row.item_count ?? 0) > 0;

              return (
                <details key={row.variant_id} className="group border-b last:border-b-0 open:bg-[#fffdf8]">
                  <summary className="grid cursor-pointer list-none grid-cols-[52px_minmax(260px,1.5fr)_150px_145px_145px_145px_135px_48px] items-stretch text-sm transition-colors hover:bg-[#fff7e8] [&::-webkit-details-marker]:hidden">
                    <div className="border-r px-3 py-4 text-center font-mono text-[10px] text-muted-foreground">{productIndex + 1}</div>
                    <div className="border-r px-3 py-3">
                      <strong className="block">{row.product_name}</strong>
                      <span className="text-xs text-muted-foreground">{row.variant_label}</span>
                    </div>
                    <SheetValue value={formatNullablePrice(row.known_supply_cost)} />
                    <SheetValue value={formatNullablePrice(row.total_cost)} />
                    <SheetValue value={formatNullablePrice(row.suggested_price, "Pendiente")} emphasis />
                    <SheetValue value={formatPrice(Number(row.published_price))} />
                    <div className="flex items-center justify-center border-r px-3 py-3">
                      {!hasItems ? (
                        <StatusBadge tone="warning">Sin receta</StatusBadge>
                      ) : missingPriceCount > 0 ? (
                        <StatusBadge tone="warning">{missingPriceCount} sin precio</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Lista</StatusBadge>
                      )}
                    </div>
                    <div className="flex items-center justify-center px-3 py-3">
                      <span className="text-lg text-muted-foreground transition-transform group-open:rotate-90">›</span>
                    </div>
                  </summary>

                  <div className="border-t bg-muted/10 p-4 sm:p-5">
                    {row.notes && <p className="mb-4 max-w-5xl text-xs text-muted-foreground">{row.notes}</p>}
                    {!hasItems && (
                      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Esta variante todavía no tiene insumos. Podés cargarlos en la última fila de la tabla.
                      </p>
                    )}
                    {missingPriceCount > 0 && (
                      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Hay {missingPriceCount} {missingPriceCount === 1 ? "insumo sin precio" : "insumos sin precio"}. La publicación se habilita al completar todos los costos.
                      </p>
                    )}

                    <div className="mb-4 grid grid-cols-4 overflow-hidden rounded-xl border bg-white text-xs">
                      <FormulaCell label="1 · Costo del lote" value={formatNullablePrice(row.known_supply_cost)} detail="Σ cantidad × costo unitario" />
                      <FormulaCell label="2 · Costo por producto" value={formatNullablePrice(row.total_cost)} detail={`Lote ÷ rendimiento ${row.yield_quantity ?? 1}`} />
                      <FormulaCell label="3 · Antes de redondear" value={formatNullablePrice(row.unrounded_suggested_price)} detail={`Costo ÷ (1 − ${row.target_margin_percent ?? 30}%)`} />
                      <FormulaCell label="4 · Precio sugerido" value={formatNullablePrice(row.suggested_price, "Pendiente")} detail={`Redondeo ${formatPrice(Number(row.rounding_increment ?? 500))}`} last />
                    </div>

                    <div className="mb-4 overflow-hidden rounded-xl border bg-white">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_140px] bg-[#f3eee5] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <div className="border-r px-3 py-2">Rendimiento (productos)</div>
                        <div className="border-r px-3 py-2">Porciones</div>
                        <div className="border-r px-3 py-2">Margen objetivo %</div>
                        <div className="border-r px-3 py-2">Redondeo</div>
                        <div className="px-3 py-2 text-center">Acción</div>
                      </div>
                      <form action={updateRecipeSettings} className="grid grid-cols-[1fr_1fr_1fr_1fr_140px]">
                        <input type="hidden" name="variant_id" value={row.variant_id} />
                        <SheetNumberInput name="yield_quantity" value={row.yield_quantity ?? 1} />
                        <SheetNumberInput name="servings" value={row.servings ?? 1} />
                        <SheetNumberInput name="target_margin_percent" value={row.target_margin_percent ?? 30} />
                        <SheetNumberInput name="rounding_increment" value={row.rounding_increment ?? 500} />
                        <div className="flex items-center justify-center p-2">
                          <Button type="submit" size="sm" variant="outline">Guardar parámetros</Button>
                        </div>
                      </form>
                    </div>

                    <div className="overflow-x-auto rounded-xl border bg-white">
                      <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-xs">
                        <thead className="bg-[#f3eee5] text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <SheetHeader className="w-10 text-center">#</SheetHeader>
                            <SheetHeader className="min-w-[190px]">Insumo</SheetHeader>
                            <SheetHeader className="min-w-[125px]">Sección</SheetHeader>
                            <SheetHeader className="w-[110px] text-right">Cantidad</SheetHeader>
                            <SheetHeader className="w-[85px]">Unidad</SheetHeader>
                            <SheetHeader className="w-[135px] text-right">Costo unitario</SheetHeader>
                            <SheetHeader className="w-[160px] text-right">Cálculo</SheetHeader>
                            <SheetHeader className="min-w-[210px]">Detalle</SheetHeader>
                            <SheetHeader className="w-[145px] text-center">Acciones</SheetHeader>
                          </tr>
                        </thead>
                        <tbody>
                          {sections.map((section) => {
                            const sectionItems = items.filter((item) => item.section_id === section.id);
                            return [
                              <tr key={`${section.id}-heading`} className="bg-[#faf6ee]">
                                <td colSpan={9} className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  {section.name} · {sectionItems.length} {sectionItems.length === 1 ? "insumo" : "insumos"}
                                </td>
                              </tr>,
                              ...sectionItems.map((item, itemIndex) => {
                                const updateFormId = `recipe-item-${item.id}`;
                                return (
                                  <tr key={item.id} className="odd:bg-white even:bg-[#fcfaf6] hover:bg-[#fff7e8]">
                                    <SheetCell className="text-center font-mono text-[10px] text-muted-foreground">{itemIndex + 1}</SheetCell>
                                    <SheetCell className="font-medium">
                                      {item.ingredient_name}
                                      <span className="block text-[10px] font-normal text-muted-foreground">
                                        {item.supply_type === "packaging" ? "Packaging" : "Ingrediente"}
                                      </span>
                                    </SheetCell>
                                    <SheetCell>
                                      <select form={updateFormId} name="section_id" defaultValue={item.section_id} className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" required>
                                        {sections.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                      </select>
                                    </SheetCell>
                                    <SheetCell>
                                      <Input form={updateFormId} name="quantity" type="number" min="0.001" step="0.001" defaultValue={String(item.quantity)} className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                                    </SheetCell>
                                    <SheetCell>{item.supply_type === "packaging" ? "unidad" : item.base_unit}</SheetCell>
                                    <SheetCell className="text-right tabular-nums">
                                      {item.effective_unit_cost === null ? <span className="text-destructive">Sin precio</span> : `${formatPrice(Number(item.effective_unit_cost))}/${item.base_unit}`}
                                    </SheetCell>
                                    <SheetCell className="text-right tabular-nums">
                                      {item.line_cost === null ? "—" : `${item.quantity} × ${Number(item.effective_unit_cost).toFixed(2)} = ${formatNullablePrice(item.line_cost)}`}
                                    </SheetCell>
                                    <SheetCell>
                                      <Input form={updateFormId} name="quantity_note" defaultValue={item.quantity_note ?? ""} placeholder="Nota opcional" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                                    </SheetCell>
                                    <SheetCell>
                                      <div className="flex items-center justify-center gap-1">
                                        <form id={updateFormId} action={updateCatalogRecipeItem}>
                                          <input type="hidden" name="recipe_item_id" value={item.id} />
                                          <Button type="submit" size="sm" variant="outline" className="h-7 px-2">Guardar</Button>
                                        </form>
                                        <form action={deleteRecipeItem}>
                                          <input type="hidden" name="recipe_item_id" value={item.id} />
                                          <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-destructive">Quitar</Button>
                                        </form>
                                      </div>
                                    </SheetCell>
                                  </tr>
                                );
                              }),
                            ];
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50/50">
                            <td className="border-r border-t px-3 py-2 text-center font-semibold text-emerald-800">+</td>
                            <td className="border-r border-t p-1">
                              <form id={`add-item-${row.variant_id}`} action={addCatalogRecipeItem}>
                                <input type="hidden" name="variant_id" value={row.variant_id} />
                                <input type="hidden" name="recipe_id" value={row.recipe_id ?? ""} />
                              </form>
                              <select form={`add-item-${row.variant_id}`} name="ingredient_id" className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" defaultValue="" required>
                                <option value="" disabled>Seleccionar insumo…</option>
                                {ingredientRows.map((ingredient) => (
                                  <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="border-r border-t p-1">
                              <select form={`add-item-${row.variant_id}`} name="section_id" className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" defaultValue="" required={sections.length > 0}>
                                <option value="" disabled>Sección…</option>
                                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                              </select>
                            </td>
                            <td className="border-r border-t p-1">
                              <Input form={`add-item-${row.variant_id}`} name="quantity" type="number" min="0.001" step="0.001" placeholder="0" className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                            </td>
                            <td className="border-r border-t px-3 py-2 text-muted-foreground">según insumo</td>
                            <td className="border-r border-t px-3 py-2 text-right text-muted-foreground">automático</td>
                            <td className="border-r border-t px-3 py-2 text-right text-muted-foreground">automático</td>
                            <td className="border-r border-t p-1">
                              <Input form={`add-item-${row.variant_id}`} name="quantity_note" placeholder="Detalle opcional" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                            </td>
                            <td className="border-t px-3 py-2 text-center">
                              <Button form={`add-item-${row.variant_id}`} type="submit" size="sm" className="h-7 px-2" disabled={ingredientRows.length === 0}>Agregar fila</Button>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {row.servings ?? 0} porciones · costo por porción {formatNullablePrice(row.cost_per_serving)} · sugerido por porción {formatNullablePrice(row.suggested_price_per_serving)}
                      </p>
                      <form action={publishSuggestedPrice}>
                        <input type="hidden" name="variant_id" value={row.variant_id} />
                        <Button type="submit" disabled={row.suggested_price === null}>Publicar precio sugerido</Button>
                      </form>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function SheetHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`border-b border-r px-3 py-3 font-semibold last:border-r-0 ${className}`}>
      {children}
    </th>
  );
}

function SheetCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-r px-3 py-2.5 align-middle last:border-r-0 ${className}`}>{children}</td>;
}

function SheetValue({ value, emphasis = false }: { value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-end border-r px-3 py-3 text-right tabular-nums ${emphasis ? "font-semibold text-primary" : ""}`}>
      {value}
    </div>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "success" | "warning" }) {
  return (
    <span className={tone === "success"
      ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800"
      : "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900"}
    >
      {children}
    </span>
  );
}

function FormulaCell({
  label,
  value,
  detail,
  last = false,
}: {
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div className={`p-3 ${last ? "" : "border-r"}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm tabular-nums">{value}</strong>
      <span className="mt-1 block text-[10px] text-muted-foreground">{detail}</span>
    </div>
  );
}

function SheetNumberInput({ name, value }: { name: string; value: number | string }) {
  return (
    <div className="border-r p-1">
      <Input name={name} type="number" min="0" step="0.01" defaultValue={String(value)} className="h-9 border-0 bg-transparent text-right shadow-none" required />
    </div>
  );
}

function formatNullablePrice(value: number | string | null | undefined, fallback = "—") {
  return value === null || value === undefined ? fallback : formatPrice(Number(value));
}

function PurchaseUnitSelect({
  id,
  defaultValue,
  form,
  compact = false,
}: {
  id?: string;
  defaultValue?: string;
  form?: string;
  compact?: boolean;
}) {
  return (
    <select
      id={id}
      form={form}
      name="purchase_unit"
      defaultValue={defaultValue ?? ""}
      className={compact ? "h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" : "h-9 w-full rounded-md border bg-transparent px-2 text-sm"}
      required
    >
      <option value="" disabled>Unidad…</option>
      <option value="g">gramos</option>
      <option value="kg">kilogramos</option>
      <option value="ml">mililitros</option>
      <option value="l">litros</option>
      <option value="unit">unidad</option>
    </select>
  );
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
