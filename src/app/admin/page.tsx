import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
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
        <div className="border-b p-6">
          <h2 className="text-2xl">Costos actuales</h2>
          <p className="text-sm text-muted-foreground">
            Cada actualización conserva el precio anterior en el historial.
          </p>
        </div>
        {ingredientRows.length === 0 ? (
          <p className="p-6 text-muted-foreground">Todavía no hay insumos cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Insumo</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Marca</th>
                  <th className="px-5 py-3">Proveedor</th>
                  <th className="px-5 py-3">Precio</th>
                  <th className="px-5 py-3">Contenido</th>
                  <th className="px-5 py-3">Costo unitario</th>
                  <th className="px-5 py-3">Nuevo precio</th>
                </tr>
              </thead>
              <tbody>
                {ingredientRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-5 py-4 font-medium">
                      {row.name}
                      {row.size_label && <span className="block text-xs font-normal text-muted-foreground">{row.size_label}</span>}
                      {row.price_change_percent !== null && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {(Number(row.price_change_percent) >= 0 ? "+" : "") +
                            Number(row.price_change_percent).toFixed(1) + "%"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.supply_type === "packaging" ? "Packaging" : "Ingrediente"}
                      <span className="block text-xs text-muted-foreground">
                        {row.auto_update_enabled ? "Precio automático" : "Precio manual"}
                      </span>
                      {row.last_price_sync_at && (
                        <span
                          className={row.last_price_sync_status === "error" ? "block text-xs text-destructive" : "block text-xs text-muted-foreground"}
                          title={row.last_price_sync_message ?? undefined}
                        >
                          {row.last_price_sync_status === "error" ? "Error de sincronización" : `Actualizado ${formatSyncDate(row.last_price_sync_at)}`}
                        </span>
                      )}
                      {row.source_url && (
                        <a href={row.source_url} target="_blank" rel="noreferrer" className="block text-xs underline">
                          Ver fuente
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-4">{row.brand || "—"}</td>
                    <td className="px-5 py-4">{row.supplier || "—"}</td>
                    <td className="px-5 py-4">
                      {row.package_price === null ? "—" : formatPrice(Number(row.package_price))}
                    </td>
                    <td className="px-5 py-4">
                      {row.supply_type === "packaging"
                        ? row.size_label ?? "—"
                        : `${row.package_quantity ?? "—"} ${row.purchase_unit ?? row.base_unit}`}
                      {row.conversion_to_base !== null && Number(row.conversion_to_base) !== 1 && (
                        <span className="block text-xs text-muted-foreground">
                          1 {row.purchase_unit} = {row.conversion_to_base} {row.base_unit}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.effective_unit_cost === null
                        ? "—"
                        : "$" + Number(row.effective_unit_cost).toFixed(2) + " / " + row.base_unit}
                    </td>
                    <td className="px-5 py-4">
                      <form action={recordIngredientPrice} className={row.supply_type === "packaging" ? "flex min-w-[240px] gap-2" : "grid min-w-[680px] grid-cols-7 gap-2"}>
                        <input type="hidden" name="ingredient_id" value={row.id} />
                        <input type="hidden" name="base_unit" value={row.base_unit} />
                        {row.supply_type === "packaging" && (
                          <>
                            <input type="hidden" name="package_quantity" value="1" />
                            <input type="hidden" name="purchase_unit" value="unit" />
                            <input type="hidden" name="conversion_to_base" value="1" />
                            <input type="hidden" name="brand" value="" />
                            <input type="hidden" name="supplier" value="" />
                          </>
                        )}
                        {row.supply_type === "ingredient" && (
                          <>
                        <Input
                          aria-label="Contenido del envase"
                          name="package_quantity"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={row.package_quantity === null ? "" : String(row.package_quantity)}
                          className="w-24"
                          required
                        />
                        <PurchaseUnitSelect defaultValue={row.purchase_unit ?? row.base_unit} />
                        <Input
                          aria-label="Equivalencia en unidad base"
                          name="conversion_to_base"
                          type="number"
                          min="0.001"
                          step="0.001"
                          defaultValue={row.conversion_to_base ?? ""}
                          placeholder="Equivalencia"
                        />
                        <Input
                          aria-label="Nuevo precio"
                          name="package_price"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                        <Input
                          aria-label="Marca"
                          name="brand"
                          defaultValue={row.brand ?? ""}
                          placeholder="Marca"
                        />
                        <Input
                          aria-label="Proveedor"
                          name="supplier"
                          defaultValue={row.supplier ?? ""}
                          placeholder="Proveedor"
                        />
                          </>
                        )}
                        {row.supply_type === "packaging" && (
                          <Input aria-label="Nuevo precio" name="package_price" type="number" min="0" step="0.01" required />
                        )}
                        <Button type="submit" size="sm">Actualizar</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl">Recetas y precios calculados</h2>
            <p className="text-sm text-muted-foreground">
              Cada costo usa el precio vigente del insumo. Si falta un precio, la sugerencia queda pendiente.
            </p>
          </div>
          <form action={publishSuggestedPrices}>
            <Button type="submit" disabled={publishableCount === 0}>
              Publicar {publishableCount || ""} precios
            </Button>
          </form>
        </div>
        <div className="space-y-6">
          {productRows.map((row) => {
            const items = recipeItemRows.filter((item) => item.variant_id === row.variant_id);
            const sections = recipeSectionRows.filter((section) => section.recipe_id === row.recipe_id);
            const missingPriceCount = Number(row.missing_price_count ?? 0);
            const hasItems = Number(row.item_count ?? 0) > 0;

            return (
              <article key={row.variant_id} className="rounded-2xl border p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl">{row.product_name}</h3>
                    <p className="text-sm text-muted-foreground">{row.variant_label}</p>
                    {row.notes && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{row.notes}</p>}
                  </div>
                  <form action={publishSuggestedPrice}>
                    <input type="hidden" name="variant_id" value={row.variant_id} />
                    <Button type="submit" disabled={row.suggested_price === null}>
                      Publicar precio
                    </Button>
                  </form>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <CostSummary label="Costo conocido de insumos" value={formatNullablePrice(row.known_supply_cost)} />
                  <CostSummary label="Costo completo de la receta" value={formatNullablePrice(row.total_cost)} />
                  <CostSummary label="Precio sugerido" value={formatNullablePrice(row.suggested_price, "Pendiente")} />
                  <CostSummary label="Precio publicado" value={formatPrice(Number(row.published_price))} />
                </div>

                {!hasItems && (
                  <p className="mt-3 rounded-xl bg-butter p-3 text-sm">
                    Esta variante todavía no tiene insumos cargados. Agregalos debajo para calcular el precio.
                  </p>
                )}
                {missingPriceCount > 0 && (
                  <p className="mt-3 rounded-xl bg-butter p-3 text-sm">
                    Hay {missingPriceCount} {missingPriceCount === 1 ? "insumo sin precio" : "insumos sin precio"}. El precio sugerido se habilitará cuando todos tengan costo vigente.
                  </p>
                )}

                <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
                  <h4 className="font-medium">Detalle del cálculo</h4>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <CalculationLine
                      label="1. Costo del lote"
                      detail="Suma de cantidad usada × costo unitario de cada insumo"
                      value={formatNullablePrice(row.known_supply_cost)}
                    />
                    <CalculationLine
                      label="2. Costo por producto"
                      detail={`${formatNullablePrice(row.known_supply_cost)} ÷ rendimiento ${row.yield_quantity ?? 1}`}
                      value={formatNullablePrice(row.total_cost)}
                    />
                    <CalculationLine
                      label="3. Precio antes de redondear"
                      detail={`Costo ÷ (1 − ${row.target_margin_percent ?? 30}% de margen)`}
                      value={formatNullablePrice(row.unrounded_suggested_price)}
                    />
                    <CalculationLine
                      label="4. Precio sugerido"
                      detail={`Redondeado hacia arriba de a ${formatPrice(Number(row.rounding_increment ?? 500))}`}
                      value={formatNullablePrice(row.suggested_price, "Pendiente")}
                    />
                  </div>
                  {row.servings !== null && Number(row.servings) > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {row.servings} porciones · costo por porción {formatNullablePrice(row.cost_per_serving)}
                      {row.suggested_price_per_serving === null ? "" : ` · sugerido por porción ${formatPrice(Number(row.suggested_price_per_serving))}`}
                    </p>
                  )}
                </div>

                <form action={updateRecipeSettings} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input type="hidden" name="variant_id" value={row.variant_id} />
                  <CompactField label="Rendimiento (cantidad de productos producidos)" name="yield_quantity" value={row.yield_quantity ?? 1} />
                  <CompactField label="Porciones" name="servings" value={row.servings ?? 1} />
                  <CompactField label="Margen objetivo %" name="target_margin_percent" value={row.target_margin_percent ?? 30} />
                  <CompactField label="Redondeo ($)" name="rounding_increment" value={row.rounding_increment ?? 500} />
                  <Button type="submit" size="sm" variant="outline" className="mt-1 sm:col-span-2 lg:col-span-4">
                    Guardar parámetros
                  </Button>
                </form>

                <div className="mt-5 space-y-4">
                  {sections.map((section) => {
                    const sectionItems = items.filter((item) => item.section_id === section.id);
                    return (
                      <section key={section.id} className="rounded-xl border p-4">
                        <h4 className="font-medium">{section.name}</h4>
                        {sectionItems.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">Sin insumos en esta sección.</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {sectionItems.map((item) => (
                              <div key={item.id} className="rounded-lg bg-cream p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{item.ingredient_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.effective_unit_cost === null
                                        ? "Sin precio vigente"
                                        : `${item.quantity} ${item.supply_type === "packaging" ? "unidad" : item.base_unit} × ${formatPrice(Number(item.effective_unit_cost))}/${item.base_unit} = ${formatNullablePrice(item.line_cost)}`}
                                    </p>
                                    {item.package_price !== null && (
                                      <p className="text-xs text-muted-foreground">
                                        Compra actual: {formatPrice(Number(item.package_price))} por {item.package_quantity} {item.purchase_unit ?? item.base_unit}
                                      </p>
                                    )}
                                  </div>
                                  <form action={deleteRecipeItem}>
                                    <input type="hidden" name="recipe_item_id" value={item.id} />
                                    <Button type="submit" size="sm" variant="outline">Quitar</Button>
                                  </form>
                                </div>
                                <form action={updateCatalogRecipeItem} className="mt-3 grid gap-2 md:grid-cols-[150px_130px_1fr_auto]">
                                  <input type="hidden" name="recipe_item_id" value={item.id} />
                                  <select name="section_id" defaultValue={item.section_id} className="h-9 rounded-md border bg-transparent px-2 text-sm" required>
                                    {sections.map((option) => (
                                      <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                                  </select>
                                  <Input name="quantity" type="number" min="0.001" step="0.001" defaultValue={String(item.quantity)} required />
                                  <Input name="quantity_note" defaultValue={item.quantity_note ?? ""} placeholder="Detalle o equivalencia" />
                                  <Button type="submit" size="sm" variant="outline">Guardar</Button>
                                </form>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>

                <form action={addCatalogRecipeItem} className="mt-4 grid gap-2 md:grid-cols-[150px_1fr_130px_1fr_auto]">
                  <input type="hidden" name="variant_id" value={row.variant_id} />
                  <input type="hidden" name="recipe_id" value={row.recipe_id ?? ""} />
                  <select name="section_id" className="h-9 rounded-md border bg-transparent px-2 text-sm" required={sections.length > 0}>
                    <option value="">Sección…</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                  <select name="ingredient_id" className="h-9 min-w-0 rounded-md border bg-transparent px-2 text-sm" required>
                    <option value="">Insumo…</option>
                    {ingredientRows.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.supply_type === "packaging" ? `Packaging${ingredient.size_label ? ` · ${ingredient.size_label}` : ""}` : ingredient.base_unit})
                      </option>
                    ))}
                  </select>
                  <Input name="quantity" type="number" min="0.001" step="0.001" placeholder="Cantidad" required />
                  <Input name="quantity_note" placeholder="Detalle opcional" />
                  <Button type="submit" size="sm" disabled={ingredientRows.length === 0}>Agregar</Button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CostSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-sm">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CalculationLine({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong>{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function formatNullablePrice(value: number | string | null, fallback = "—") {
  return value === null ? fallback : formatPrice(Number(value));
}

function PurchaseUnitSelect({ id, defaultValue }: { id?: string; defaultValue?: string }) {
  return (
    <select
      id={id}
      name="purchase_unit"
      defaultValue={defaultValue ?? ""}
      className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
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

function CompactField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: number | string;
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <Input
        name={name}
        type="number"
        min="0"
        step="0.01"
        defaultValue={String(value)}
        className="mt-1"
        required
      />
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  placeholder,
  required = true,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={"space-y-2 " + className}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
