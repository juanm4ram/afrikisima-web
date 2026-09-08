import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addBudgetExtra,
  addBudgetSection,
  createCustomBudget,
  deleteBudgetExtra,
  deleteRecipeItem,
  setBudgetRecipeItem,
  updateCustomBudget,
} from "../actions";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

interface Budget {
  id: string;
  name: string;
  customer_name: string | null;
  event_date: string | null;
  mold_size: string | null;
  presentation: string | null;
  quoted_price: number | string | null;
  status: string;
  notes: string | null;
  labor_cost: number | string;
  packaging_cost: number | string;
  overhead_percent: number | string;
  target_margin_percent: number | string;
  rounding_increment: number | string;
  ingredient_cost: number | string;
  extra_cost: number | string;
  total_cost: number | string;
  suggested_price: number | string | null;
  quoted_result: number | string | null;
}

interface Section {
  id: string;
  recipe_id: string;
  name: string;
  sort_order: number;
}

interface RecipeItem {
  id: string;
  recipe_id: string;
  section_id: string;
  ingredient_name: string;
  base_unit: string;
  quantity: number | string;
  quantity_note: string | null;
  line_cost: number | string | null;
}

interface Ingredient {
  id: string;
  name: string;
  base_unit: string;
}

interface Extra {
  id: string;
  recipe_id: string;
  kind: string;
  name: string;
  amount: number | string;
}

export default async function BudgetsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/login");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/admin");

  const [budgetsResult, sectionsResult, itemsResult, ingredientsResult, extrasResult] =
    await Promise.all([
      supabase
        .from("recipe_budget_summary")
        .select("*")
        .is("variant_id", null)
        .order("created_at", { ascending: false }),
      supabase.from("recipe_sections").select("*").order("sort_order"),
      supabase.from("recipe_items_admin").select("*").order("ingredient_name"),
      supabase.from("current_ingredient_costs").select("id,name,base_unit").order("name"),
      supabase.from("recipe_extras").select("*").order("sort_order"),
    ]);

  const budgets = (budgetsResult.data ?? []) as Budget[];
  const sections = (sectionsResult.data ?? []) as Section[];
  const items = (itemsResult.data ?? []) as RecipeItem[];
  const ingredients = (ingredientsResult.data ?? []) as Ingredient[];
  const extras = (extrasResult.data ?? []) as Extra[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administración</p>
          <h1 className="text-4xl">Presupuestos personalizados</h1>
          <p className="mt-2 text-muted-foreground">
            Recetas por secciones con costos que siguen el precio actual de cada ingrediente.
          </p>
          <Link href="/admin" className="mt-3 inline-block text-sm underline">
            Volver a ingredientes y catálogo
          </Link>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-10 rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-2xl">Nuevo presupuesto</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Después de crearlo podrás cargar bizcocho, relleno, cobertura y presentación.
        </p>
        <form action={createCustomBudget} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field className="lg:col-span-2" label="Nombre de la torta" name="name" />
          <Field label="Cliente" name="customer_name" required={false} />
          <Field label="Fecha del evento" name="event_date" type="date" required={false} />
          <Field label="Molde" name="mold_size" placeholder="24 × 8 cm" required={false} />
          <Field label="Precio ofrecido" name="quoted_price" type="number" step="0.01" required={false} />
          <Field className="lg:col-span-4" label="Presentación" name="presentation" placeholder="Caja, tabla, decoración…" required={false} />
          <div className="flex items-end lg:col-span-2">
            <Button type="submit">Crear presupuesto</Button>
          </div>
        </form>
      </section>

      {budgets.length === 0 ? (
        <section className="rounded-3xl border bg-card p-8 text-muted-foreground">
          Todavía no hay presupuestos personalizados.
        </section>
      ) : (
        <div className="space-y-8">
          {budgets.map((budget) => {
            const budgetSections = sections.filter((section) => section.recipe_id === budget.id);
            const budgetExtras = extras.filter((extra) => extra.recipe_id === budget.id);
            return (
              <article key={budget.id} className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Summary label="Ingredientes" value={formatPrice(Number(budget.ingredient_cost))} />
                  <Summary label="Extras" value={formatPrice(Number(budget.extra_cost))} />
                  <Summary label="Costo total" value={formatPrice(Number(budget.total_cost))} />
                  <Summary
                    label="Precio sugerido"
                    value={budget.suggested_price === null ? "Pendiente" : formatPrice(Number(budget.suggested_price))}
                  />
                  <Summary
                    label="Resultado ofrecido"
                    value={budget.quoted_result === null ? "—" : formatPrice(Number(budget.quoted_result))}
                  />
                </div>

                <form action={updateCustomBudget} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <input type="hidden" name="recipe_id" value={budget.id} />
                  <Field className="lg:col-span-2" label="Nombre" name="name" defaultValue={budget.name} />
                  <Field label="Cliente" name="customer_name" defaultValue={budget.customer_name ?? ""} required={false} />
                  <Field label="Fecha" name="event_date" type="date" defaultValue={budget.event_date ?? ""} required={false} />
                  <Field label="Molde" name="mold_size" defaultValue={budget.mold_size ?? ""} required={false} />
                  <Field label="Precio ofrecido" name="quoted_price" type="number" step="0.01" defaultValue={budget.quoted_price ?? ""} required={false} />
                  <Field className="lg:col-span-2" label="Presentación" name="presentation" defaultValue={budget.presentation ?? ""} required={false} />
                  <Field label="Mano de obra" name="labor_cost" type="number" step="0.01" defaultValue={budget.labor_cost} />
                  <Field label="Packaging general" name="packaging_cost" type="number" step="0.01" defaultValue={budget.packaging_cost} />
                  <Field label="Indirectos %" name="overhead_percent" type="number" step="0.01" defaultValue={budget.overhead_percent} />
                  <Field label="Margen objetivo %" name="target_margin_percent" type="number" step="0.01" defaultValue={budget.target_margin_percent} />
                  <Field label="Redondeo" name="rounding_increment" type="number" step="0.01" defaultValue={budget.rounding_increment} />
                  <div className="space-y-2">
                    <Label htmlFor={`status-${budget.id}`}>Estado</Label>
                    <select id={`status-${budget.id}`} name="status" defaultValue={budget.status} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                      <option value="draft">Borrador</option>
                      <option value="sent">Enviado</option>
                      <option value="accepted">Aceptado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <Field className="lg:col-span-5" label="Notas" name="notes" defaultValue={budget.notes ?? ""} required={false} />
                  <div className="flex items-end">
                    <Button type="submit" variant="outline">Guardar datos</Button>
                  </div>
                </form>

                <div className="mt-7 grid gap-5 lg:grid-cols-3">
                  {budgetSections.map((section) => (
                    <section key={section.id} className="rounded-2xl border p-4">
                      <h3 className="mb-3 text-lg">{section.name}</h3>
                      <div className="space-y-2">
                        {items
                          .filter((item) => item.section_id === section.id)
                          .map((item) => (
                            <div key={item.id} className="rounded-lg bg-cream px-3 py-2 text-sm">
                              <div className="flex justify-between gap-2">
                                <span>{item.ingredient_name}</span>
                                <form action={deleteRecipeItem}>
                                  <input type="hidden" name="recipe_item_id" value={item.id} />
                                  <button type="submit" className="text-destructive" aria-label={`Quitar ${item.ingredient_name}`}>×</button>
                                </form>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} {item.base_unit}
                                {item.quantity_note ? ` · ${item.quantity_note}` : ""}
                                {item.line_cost === null ? " · Sin precio" : ` · ${formatPrice(Number(item.line_cost))}`}
                              </p>
                            </div>
                          ))}
                      </div>
                      <form action={setBudgetRecipeItem} className="mt-3 space-y-2">
                        <input type="hidden" name="recipe_id" value={budget.id} />
                        <input type="hidden" name="section_id" value={section.id} />
                        <select name="ingredient_id" className="h-9 w-full rounded-md border bg-transparent px-2 text-sm" required>
                          <option value="">Ingrediente…</option>
                          {ingredients.map((ingredient) => (
                            <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.base_unit})</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Input name="quantity" type="number" min="0.001" step="0.001" placeholder="Cantidad" required />
                          <Input name="quantity_note" placeholder="Ej.: 2 huevos" />
                          <Button type="submit" size="sm" disabled={ingredients.length === 0}>Agregar</Button>
                        </div>
                      </form>
                    </section>
                  ))}
                </div>

                <form action={addBudgetSection} className="mt-4 flex max-w-md gap-2">
                  <input type="hidden" name="recipe_id" value={budget.id} />
                  <Input name="name" placeholder="Otra sección, ej. Crumble" required />
                  <Input name="sort_order" type="number" min="0" defaultValue="40" className="w-20" required />
                  <Button type="submit" size="sm" variant="outline">Agregar sección</Button>
                </form>

                <section className="mt-7 rounded-2xl bg-muted/50 p-4">
                  <h3 className="mb-3 text-lg">Presentación y otros costos</h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {budgetExtras.map((extra) => (
                      <div key={extra.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                        <span>{extra.name}: {formatPrice(Number(extra.amount))}</span>
                        <form action={deleteBudgetExtra}>
                          <input type="hidden" name="extra_id" value={extra.id} />
                          <button type="submit" className="text-destructive" aria-label={`Quitar ${extra.name}`}>×</button>
                        </form>
                      </div>
                    ))}
                  </div>
                  <form action={addBudgetExtra} className="grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="recipe_id" value={budget.id} />
                    <select name="kind" className="h-9 rounded-md border bg-transparent px-2 text-sm">
                      <option value="presentation">Presentación</option>
                      <option value="decoration">Decoración</option>
                      <option value="delivery">Envío</option>
                      <option value="other">Otro</option>
                    </select>
                    <Input name="name" placeholder="Caja, tabla…" required />
                    <Input name="amount" type="number" min="0" step="0.01" placeholder="Costo" required />
                    <Button type="submit" size="sm">Agregar costo</Button>
                  </form>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-sm">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
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
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`${name}-${String(defaultValue ?? "new")}`}>{label}</Label>
      <Input
        id={`${name}-${String(defaultValue ?? "new")}`}
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
