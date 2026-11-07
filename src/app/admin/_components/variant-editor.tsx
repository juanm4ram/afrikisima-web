import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import {
  addCatalogRecipeItem,
  deleteRecipeItem,
  publishCustomPrice,
  publishSuggestedPrice,
  updateCatalogRecipeItem,
  updateRecipeSettings,
} from "../actions";
import {
  FormulaCell,
  SheetCell,
  SheetHeader,
  SheetNumberInput,
  formatNullablePrice,
  formatQuantity,
  unitLabel,
} from "./sheet";
import type {
  IngredientCost,
  ProductCost,
  RecipeCostCompleteness,
  RecipeItem,
  RecipeSection,
} from "./types";

export function VariantEditor({
  row,
  items,
  sections,
  completeness,
  ingredients,
}: {
  row: ProductCost;
  items: RecipeItem[];
  sections: RecipeSection[];
  completeness?: RecipeCostCompleteness;
  ingredients: IngredientCost[];
}) {
  const missingPriceCount = Number(row.missing_price_count ?? 0);
  const hasItems = Number(row.item_count ?? 0) > 0;
  const missingItems = items.filter((item) => item.effective_unit_cost === null);
  const hasPackaging = Number(completeness?.packaging_item_count ?? 1) > 0;
  const addFormId = `add-item-${row.variant_id}`;

  return (
    <div className="space-y-4 border-t bg-[#fffdf8] p-4 sm:p-5">
      {row.notes && <p className="max-w-5xl text-xs text-muted-foreground">{row.notes}</p>}

      {!hasItems && (
        <Notice>Esta variante todavía no tiene insumos. Cargalos en la última fila de la tabla.</Notice>
      )}
      {missingItems.length > 0 && (
        <Notice>
          Falta el precio de: <strong>{missingItems.map((item) => item.ingredient_name).join(", ")}</strong>.
          Cargalo en la pestaña Insumos para habilitar el precio sugerido.
        </Notice>
      )}
      {missingItems.length === 0 && missingPriceCount > 0 && (
        <Notice>Hay {missingPriceCount} insumos sin precio.</Notice>
      )}
      {hasItems && !hasPackaging && (
        <Notice>La receta no tiene packaging (caja / tablita). Agregalo para que el costo sea real.</Notice>
      )}

      <div className="grid overflow-hidden rounded-xl border bg-white text-xs sm:grid-cols-3 xl:grid-cols-6">
        <FormulaCell
          label="1 · Costo del lote"
          value={formatNullablePrice(row.known_supply_cost)}
          detail={completeness
            ? `Ingredientes ${formatPrice(Number(completeness.ingredient_cost))} + packaging ${formatPrice(Number(completeness.packaging_cost))}`
            : "Σ cantidad × costo unitario"}
        />
        <FormulaCell label="2 · Costo por producto" value={formatNullablePrice(row.total_cost)} detail={`Lote ÷ rendimiento ${row.yield_quantity ?? 1}`} />
        <FormulaCell label="3 · Antes de redondear" value={formatNullablePrice(row.unrounded_suggested_price)} detail={`Costo ÷ (1 − ${row.target_margin_percent ?? 30}%)`} />
        <FormulaCell label="4 · Precio sugerido" value={formatNullablePrice(row.suggested_price, "Pendiente")} detail={`Redondeo ${formatPrice(Number(row.rounding_increment ?? 500))}`} />
        <FormulaCell
          label="5 · Ganancia personalizada"
          value={formatNullablePrice(row.custom_profit_amount)}
          detail={row.custom_profit_type === "amount"
            ? `${formatNullablePrice(row.custom_profit_value)} fijos`
            : `${row.custom_profit_value ?? 0}% sobre el costo`}
        />
        <FormulaCell label="6 · Precio personalizado" value={formatNullablePrice(row.custom_price, "Pendiente")} detail="Costo + ganancia elegida" />
      </div>

      <form action={updateRecipeSettings} className="grid overflow-hidden rounded-xl border bg-white sm:grid-cols-3 xl:grid-cols-7">
        <input type="hidden" name="variant_id" value={row.variant_id} />
        <SheetNumberInput label="Rendimiento" name="yield_quantity" value={row.yield_quantity ?? 1} />
        <SheetNumberInput label="Porciones" name="servings" value={row.servings ?? 1} />
        <SheetNumberInput label="Margen objetivo %" name="target_margin_percent" value={row.target_margin_percent ?? 30} />
        <SheetNumberInput label="Redondeo $" name="rounding_increment" value={row.rounding_increment ?? 500} />
        <label className="block border-b border-r p-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tipo de ganancia
          <select name="custom_profit_type" defaultValue={row.custom_profit_type ?? "percent"} className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm font-normal normal-case tracking-normal">
            <option value="percent">% sobre costo</option>
            <option value="amount">Importe fijo ($)</option>
          </select>
        </label>
        <SheetNumberInput label="Ganancia" name="custom_profit_value" value={row.custom_profit_value ?? 0} />
        <div className="flex items-end justify-center border-b p-2">
          <Button type="submit" size="sm" variant="outline" className="w-full">Guardar parámetros</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-xs">
          <thead className="bg-[#f3eee5] text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <SheetHeader className="min-w-[200px]">Insumo</SheetHeader>
              <SheetHeader className="min-w-[120px]">Sección</SheetHeader>
              <SheetHeader className="w-[110px] text-right">Cantidad</SheetHeader>
              <SheetHeader className="w-[60px]">Unidad</SheetHeader>
              <SheetHeader className="w-[150px] text-right">Costo</SheetHeader>
              <SheetHeader className="min-w-[200px]">Detalle</SheetHeader>
              <SheetHeader className="w-[140px] text-center">Acciones</SheetHeader>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const sectionItems = items.filter((item) => item.section_id === section.id);
              const sectionCost = sectionItems.reduce((sum, item) => sum + Number(item.line_cost ?? 0), 0);
              return [
                <tr key={`${section.id}-heading`} className="bg-[#faf6ee]">
                  <td colSpan={7} className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.name}
                    <span className="ml-2 font-normal normal-case tracking-normal">
                      {sectionItems.length} {sectionItems.length === 1 ? "insumo" : "insumos"} · {formatPrice(sectionCost)}
                    </span>
                  </td>
                </tr>,
                ...sectionItems.map((item) => {
                  const updateFormId = `recipe-item-${item.id}`;
                  return (
                    <tr key={item.id} className="odd:bg-white even:bg-[#fcfaf6] hover:bg-[#fff7e8]">
                      <SheetCell className="font-medium">
                        {item.ingredient_name}
                        {item.supply_type === "packaging" && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-normal text-muted-foreground">packaging</span>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <select form={updateFormId} name="section_id" defaultValue={item.section_id} className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" required>
                          {sections.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select>
                      </SheetCell>
                      <SheetCell>
                        <Input form={updateFormId} aria-label={`Cantidad de ${item.ingredient_name}`} name="quantity" type="number" min="0.001" step="0.001" defaultValue={String(item.quantity)} className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                      </SheetCell>
                      <SheetCell className="text-muted-foreground">{item.supply_type === "packaging" ? "u." : unitLabel(item.base_unit)}</SheetCell>
                      <SheetCell className="text-right tabular-nums">
                        {item.line_cost === null ? (
                          <span className="font-medium text-destructive">Sin precio</span>
                        ) : (
                          <>
                            <span className="block font-medium">{formatNullablePrice(item.line_cost)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatQuantity(item.quantity)} × ${Number(item.effective_unit_cost).toFixed(2)}
                            </span>
                          </>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <Input form={updateFormId} aria-label={`Nota de ${item.ingredient_name}`} name="quantity_note" defaultValue={item.quantity_note ?? ""} placeholder="Nota opcional" className="h-8 border-0 bg-transparent px-1 shadow-none" />
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
            <tr className="bg-emerald-50/60">
              <td className="border-r border-t p-1">
                <form id={addFormId} action={addCatalogRecipeItem}>
                  <input type="hidden" name="variant_id" value={row.variant_id} />
                  <input type="hidden" name="recipe_id" value={row.recipe_id ?? ""} />
                </form>
                <select form={addFormId} name="ingredient_id" aria-label="Insumo a agregar" className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" defaultValue="" required>
                  <option value="" disabled>+ Agregar insumo…</option>
                  <optgroup label="Ingredientes">
                    {ingredients.filter((i) => i.supply_type === "ingredient").map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Packaging">
                    {ingredients.filter((i) => i.supply_type === "packaging").map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                    ))}
                  </optgroup>
                </select>
              </td>
              <td className="border-r border-t p-1">
                <select form={addFormId} name="section_id" aria-label="Sección" className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none" defaultValue="" required={sections.length > 0}>
                  <option value="" disabled>Sección…</option>
                  {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </td>
              <td className="border-r border-t p-1">
                <Input form={addFormId} aria-label="Cantidad" name="quantity" type="number" min="0.001" step="0.001" placeholder="0" className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
              </td>
              <td className="border-r border-t px-3 py-2 text-muted-foreground">—</td>
              <td className="border-r border-t px-3 py-2 text-right text-muted-foreground">automático</td>
              <td className="border-r border-t p-1">
                <Input form={addFormId} aria-label="Detalle" name="quantity_note" placeholder="Detalle opcional" className="h-8 border-0 bg-transparent px-1 shadow-none" />
              </td>
              <td className="border-t px-3 py-2 text-center">
                <Button form={addFormId} type="submit" size="sm" className="h-7 px-2" disabled={ingredients.length === 0}>Agregar</Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {row.servings ?? 0} porciones · costo/porción {formatNullablePrice(row.cost_per_serving)} · sugerido/porción {formatNullablePrice(row.suggested_price_per_serving)} · personalizado/porción {formatNullablePrice(row.custom_price_per_serving)}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={publishSuggestedPrice}>
            <input type="hidden" name="variant_id" value={row.variant_id} />
            <Button type="submit" variant="outline" disabled={row.suggested_price === null}>
              Usar sugerido {row.suggested_price !== null && `(${formatNullablePrice(row.suggested_price)})`}
            </Button>
          </form>
          <form action={publishCustomPrice}>
            <input type="hidden" name="variant_id" value={row.variant_id} />
            <Button type="submit" disabled={row.custom_price === null}>
              Usar personalizado {row.custom_price !== null && `(${formatNullablePrice(row.custom_price)})`}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{children}</p>
  );
}
