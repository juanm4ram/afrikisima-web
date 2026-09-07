import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addIngredient,
  deleteRecipeItem,
  publishSuggestedPrices,
  recordIngredientPrice,
  setRecipeItem,
  updateRecipeSettings,
} from "./actions";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

interface IngredientCost {
  id: string;
  name: string;
  base_unit: string;
  package_quantity: number | string | null;
  package_price: number | string | null;
  supplier: string | null;
  effective_unit_cost: number | string | null;
  price_change_percent: number | string | null;
}

interface ProductCost {
  variant_id: string;
  product_name: string;
  variant_label: string;
  published_price: number | string;
  suggested_price: number | string | null;
  yield_quantity: number | string | null;
  labor_cost: number | string | null;
  packaging_cost: number | string | null;
  overhead_percent: number | string | null;
  target_margin_percent: number | string | null;
  rounding_increment: number | string | null;
  total_cost: number | string | null;
}

interface RecipeItem {
  id: string;
  variant_id: string;
  ingredient_name: string;
  base_unit: string;
  quantity: number | string;
  line_cost: number | string | null;
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
        <LogoutButton />
      </main>
    );
  }

  const [{ data: ingredients }, { data: productCosts }, { data: recipeItems }] =
    await Promise.all([
    supabase.from("current_ingredient_costs").select("*").order("name"),
    supabase.from("product_costs").select("*").order("product_name"),
    supabase.from("recipe_items_admin").select("*").order("ingredient_name"),
  ]);
  const ingredientRows = (ingredients ?? []) as IngredientCost[];
  const productRows = (productCosts ?? []) as ProductCost[];
  const recipeItemRows = (recipeItems ?? []) as RecipeItem[];
  const publishableCount = productRows.filter((row) => row.suggested_price !== null).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administración</p>
          <h1 className="text-4xl">Ingredientes y precios</h1>
          <p className="mt-2 text-muted-foreground">Sesión: {auth.user.email}</p>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-10 rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-2xl">Agregar ingrediente</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Indicá el contenido del envase y su precio; el costo unitario se calcula solo.
        </p>
        <form action={addIngredient} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field className="lg:col-span-2" label="Ingrediente" name="name" />
          <div className="space-y-2">
            <Label htmlFor="base_unit">Unidad</Label>
            <select
              id="base_unit"
              name="base_unit"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="g">gramos</option>
              <option value="ml">mililitros</option>
              <option value="unit">unidades</option>
            </select>
          </div>
          <Field label="Contenido" name="package_quantity" type="number" step="0.01" />
          <Field label="Precio del envase" name="package_price" type="number" step="0.01" />
          <Field label="Merma %" name="waste_percent" type="number" step="0.1" defaultValue="0" />
          <Field className="lg:col-span-2" label="Proveedor" name="supplier" required={false} />
          <div className="flex items-end lg:col-span-2">
            <Button type="submit">Guardar ingrediente</Button>
          </div>
        </form>
      </section>

      <section className="mb-10 overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-2xl">Costos actuales</h2>
          <p className="text-sm text-muted-foreground">
            Cada actualización conserva el precio anterior en el historial.
          </p>
        </div>
        {ingredientRows.length === 0 ? (
          <p className="p-6 text-muted-foreground">Todavía no hay ingredientes cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Ingrediente</th>
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
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.supplier || "Sin proveedor"}
                        {row.price_change_percent !== null &&
                          " · " +
                            (Number(row.price_change_percent) >= 0 ? "+" : "") +
                            Number(row.price_change_percent).toFixed(1) +
                            "%"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {row.package_price === null ? "—" : formatPrice(Number(row.package_price))}
                    </td>
                    <td className="px-5 py-4">
                      {row.package_quantity ?? "—"} {row.base_unit}
                    </td>
                    <td className="px-5 py-4">
                      {row.effective_unit_cost === null
                        ? "—"
                        : "$" + Number(row.effective_unit_cost).toFixed(2) + " / " + row.base_unit}
                    </td>
                    <td className="px-5 py-4">
                      <form action={recordIngredientPrice} className="flex gap-2">
                        <input type="hidden" name="ingredient_id" value={row.id} />
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
                        <Input
                          aria-label="Nuevo precio"
                          name="package_price"
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-28"
                          required
                        />
                        <input type="hidden" name="supplier" value={row.supplier ?? ""} />
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
            <h2 className="text-2xl">Precios calculados</h2>
            <p className="text-sm text-muted-foreground">
              Solo aparecen sugerencias cuando la receta tiene ingredientes.
            </p>
          </div>
          <form action={publishSuggestedPrices}>
            <Button type="submit" disabled={publishableCount === 0}>
              Publicar {publishableCount || ""} precios
            </Button>
          </form>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {productRows.map((row) => (
            <article key={row.variant_id} className="rounded-2xl border p-5">
              <h3 className="text-lg">{row.product_name}</h3>
              <p className="text-sm text-muted-foreground">{row.variant_label}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-sm">
                <div>
                  <span className="block text-xs text-muted-foreground">Costo</span>
                  <strong>
                    {row.total_cost === null ? "—" : formatPrice(Number(row.total_cost))}
                  </strong>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Publicado</span>
                  <strong>{formatPrice(Number(row.published_price))}</strong>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Sugerido</span>
                  <strong>
                    {row.suggested_price === null
                      ? "Pendiente"
                      : formatPrice(Number(row.suggested_price))}
                  </strong>
                </div>
              </div>

              <form action={updateRecipeSettings} className="mt-4 grid grid-cols-3 gap-2">
                <input type="hidden" name="variant_id" value={row.variant_id} />
                <CompactField label="Rendimiento" name="yield_quantity" value={row.yield_quantity ?? 1} />
                <CompactField label="Mano de obra" name="labor_cost" value={row.labor_cost ?? 0} />
                <CompactField label="Packaging" name="packaging_cost" value={row.packaging_cost ?? 0} />
                <CompactField label="Indirectos %" name="overhead_percent" value={row.overhead_percent ?? 0} />
                <CompactField label="Margen %" name="target_margin_percent" value={row.target_margin_percent ?? 30} />
                <CompactField label="Redondeo" name="rounding_increment" value={row.rounding_increment ?? 500} />
                <Button type="submit" size="sm" variant="outline" className="col-span-3 mt-1">
                  Guardar cálculo
                </Button>
              </form>

              <div className="mt-4 space-y-2">
                {recipeItemRows
                  .filter((item) => item.variant_id === row.variant_id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm"
                    >
                      <span>
                        {item.ingredient_name}: {item.quantity} {item.base_unit}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {item.line_cost === null ? "—" : formatPrice(Number(item.line_cost))}
                        </span>
                        <form action={deleteRecipeItem}>
                          <input type="hidden" name="recipe_item_id" value={item.id} />
                          <button
                            type="submit"
                            className="text-destructive"
                            aria-label={"Quitar " + item.ingredient_name}
                          >
                            ×
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
              </div>

              <form action={setRecipeItem} className="mt-3 flex gap-2">
                <input type="hidden" name="variant_id" value={row.variant_id} />
                <select
                  name="ingredient_id"
                  className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
                  required
                >
                  <option value="">Ingrediente…</option>
                  {ingredientRows.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Cantidad usada"
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Cantidad"
                  className="w-28"
                  required
                />
                <Button type="submit" size="sm" disabled={ingredientRows.length === 0}>
                  Agregar
                </Button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
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
  required = true,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
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
        required={required}
      />
    </div>
  );
}
