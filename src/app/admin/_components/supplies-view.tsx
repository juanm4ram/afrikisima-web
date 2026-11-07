import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordIngredientPrice } from "../actions";
import { SupplyForm } from "../supply-form";
import { buildHref } from "./products-view";
import {
  EmptyState,
  FilterPills,
  SearchBox,
  SectionCard,
  SheetCell,
  SheetHeader,
  StatusBadge,
  formatNullablePrice,
  normalize,
} from "./sheet";
import type { IngredientCost } from "./types";

export const supplyFilters = ["todos", "ingredientes", "packaging", "sin-precio", "errores"] as const;
export type SupplyFilter = (typeof supplyFilters)[number];

export function SuppliesView({
  ingredients,
  usage,
  query,
  filter,
}: {
  ingredients: IngredientCost[];
  /** Cantidad de recetas que usan cada insumo. */
  usage: Map<string, number>;
  query: string;
  filter: SupplyFilter;
}) {
  const counts: Record<SupplyFilter, number> = {
    todos: ingredients.length,
    ingredientes: ingredients.filter((row) => row.supply_type === "ingredient").length,
    packaging: ingredients.filter((row) => row.supply_type === "packaging").length,
    "sin-precio": ingredients.filter((row) => row.effective_unit_cost === null).length,
    errores: ingredients.filter((row) => row.last_price_sync_status === "error").length,
  };
  const needle = normalize(query);
  const rows = ingredients.filter((row) => {
    if (needle) {
      const haystack = normalize([row.name, row.brand, row.supplier, row.size_label].filter(Boolean).join(" "));
      if (!haystack.includes(needle)) return false;
    }
    switch (filter) {
      case "ingredientes":
        return row.supply_type === "ingredient";
      case "packaging":
        return row.supply_type === "packaging";
      case "sin-precio":
        return row.effective_unit_cost === null;
      case "errores":
        return row.last_price_sync_status === "error";
      default:
        return true;
    }
  });

  return (
    <>
      <details className="group mb-6 rounded-3xl border bg-card shadow-sm [&>section]:mb-0 [&>section]:rounded-t-none [&>section]:border-0 [&>section]:shadow-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <strong className="block text-lg font-medium">Agregar insumo nuevo</strong>
            <span className="text-xs text-muted-foreground">Ingrediente o packaging (caja, tablita…) con su primer precio.</span>
          </span>
          <span className="text-lg text-muted-foreground transition-transform group-open:rotate-90">›</span>
        </summary>
        <SupplyForm />
      </details>

      <SectionCard
        eyebrow="Insumos"
        title="Lista de insumos"
        description="Editá marca, proveedor o presentación y cargá el precio nuevo. Cada actualización conserva el historial."
        aside={<SearchBox defaultValue={query} placeholder="Buscar insumo, marca o proveedor…" hidden={{ vista: "insumos", tipo: filter }} />}
      >
        <div className="border-b px-5 py-3">
          <FilterPills
            active={filter}
            hrefFor={(value) => buildHref({ vista: "insumos", tipo: value, q: query })}
            options={[
              { value: "todos", label: "Todos", count: counts.todos },
              { value: "ingredientes", label: "Ingredientes", count: counts.ingredientes },
              { value: "packaging", label: "Packaging", count: counts.packaging },
              { value: "sin-precio", label: "Sin precio", count: counts["sin-precio"] },
              { value: "errores", label: "Error de sincronización", count: counts.errores },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState>No hay insumos que coincidan con el filtro.</EmptyState>
        ) : (
          <div className="max-h-[720px] overflow-auto">
            <table className="w-full min-w-[1380px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#f3eee5] text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SheetHeader className="sticky left-0 z-30 min-w-[230px] bg-[#f3eee5]">Insumo</SheetHeader>
                  <SheetHeader className="min-w-[120px]">Origen</SheetHeader>
                  <SheetHeader className="min-w-[140px]">Marca</SheetHeader>
                  <SheetHeader className="min-w-[150px]">Proveedor</SheetHeader>
                  <SheetHeader className="min-w-[100px] text-right">Contenido</SheetHeader>
                  <SheetHeader className="min-w-[110px]">Unidad compra</SheetHeader>
                  <SheetHeader className="min-w-[95px] text-right">Conversión</SheetHeader>
                  <SheetHeader className="min-w-[130px] text-right">Precio actual</SheetHeader>
                  <SheetHeader className="min-w-[120px] text-right">Nuevo precio</SheetHeader>
                  <SheetHeader className="min-w-[90px] text-center">Acción</SheetHeader>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const formId = `supply-${row.id}`;
                  const isPackaging = row.supply_type === "packaging";
                  const missingPrice = row.effective_unit_cost === null;
                  const change = row.price_change_percent === null ? null : Number(row.price_change_percent);
                  const usedBy = usage.get(row.id) ?? 0;
                  return (
                    <tr key={row.id} className={missingPrice ? "bg-amber-50/70 hover:bg-amber-50" : "odd:bg-white even:bg-[#fcfaf6] hover:bg-[#fff7e8]"}>
                      <SheetCell className="sticky left-0 z-10 bg-inherit">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{row.name}</span>
                          <StatusBadge tone={isPackaging ? "info" : "neutral"}>{isPackaging ? "Packaging" : "Ingrediente"}</StatusBadge>
                        </div>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {[row.size_label, usedBy > 0 ? `en ${usedBy} ${usedBy === 1 ? "receta" : "recetas"}` : "sin uso en recetas"].filter(Boolean).join(" · ")}
                        </span>
                      </SheetCell>
                      <SheetCell>
                        <span className="block text-[11px]">{row.auto_update_enabled ? "Automático" : "Manual"}</span>
                        {row.last_price_sync_status === "error" ? (
                          <span className="block text-[10px] text-destructive" title={row.last_price_sync_message ?? undefined}>Error al sincronizar</span>
                        ) : row.last_price_sync_at ? (
                          <span className="block text-[10px] text-muted-foreground">{formatSyncDate(row.last_price_sync_at)}</span>
                        ) : null}
                        {row.source_url && (
                          <a href={row.source_url} target="_blank" rel="noreferrer" className="block text-[10px] underline">Ver fuente</a>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} aria-label={`Marca de ${row.name}`} name="brand" defaultValue={row.brand ?? ""} placeholder="Marca" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} aria-label={`Proveedor de ${row.name}`} name="supplier" defaultValue={row.supplier ?? ""} placeholder="Proveedor" className="h-8 border-0 bg-transparent px-1 shadow-none" />
                      </SheetCell>
                      <SheetCell className="text-right">
                        {isPackaging ? (
                          <>
                            <span>1 unidad</span>
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
                          <PurchaseUnitSelect form={formId} defaultValue={row.purchase_unit ?? row.base_unit} />
                        )}
                      </SheetCell>
                      <SheetCell className="text-right">
                        {isPackaging ? (
                          <><span>1</span><input form={formId} type="hidden" name="conversion_to_base" value="1" /></>
                        ) : (
                          <Input form={formId} aria-label={`Conversión de ${row.name}`} name="conversion_to_base" type="number" min="0.001" step="0.001" defaultValue={row.conversion_to_base ?? ""} className="h-8 border-0 bg-transparent px-1 text-right shadow-none" required />
                        )}
                      </SheetCell>
                      <SheetCell className="text-right tabular-nums">
                        {missingPrice ? (
                          <span className="font-medium text-amber-900">Sin precio</span>
                        ) : (
                          <>
                            <span className="block font-medium">{formatNullablePrice(row.package_price)}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              ${Number(row.effective_unit_cost).toFixed(2)} / {row.base_unit === "unit" ? "u." : row.base_unit}
                              {change !== null && change !== 0 && (
                                <span className={change > 0 ? "ml-1 text-destructive" : "ml-1 text-emerald-700"}>
                                  {change > 0 ? "+" : ""}{change.toFixed(1)}%
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </SheetCell>
                      <SheetCell>
                        <Input form={formId} aria-label={`Nuevo precio de ${row.name}`} name="package_price" type="number" min="0" step="0.01" placeholder="$ 0" className="h-8 bg-white text-right tabular-nums" required />
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
      </SectionCard>
    </>
  );
}

function PurchaseUnitSelect({ defaultValue, form }: { defaultValue?: string; form: string }) {
  return (
    <select
      form={form}
      name="purchase_unit"
      aria-label="Unidad de compra"
      defaultValue={defaultValue ?? ""}
      className="h-8 w-full border-0 bg-transparent px-1 text-xs outline-none"
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
