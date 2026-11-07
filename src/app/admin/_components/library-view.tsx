import { buildHref } from "./products-view";
import {
  EmptyState,
  FilterPills,
  SectionCard,
  StatusBadge,
  formatNullablePrice,
  formatQuantity,
  unitLabel,
} from "./sheet";
import type { ProductionRule, ScalingRule, TemplateCost, TemplateItem } from "./types";

export const libraryFilters = ["todos", "bizcochos", "rellenos", "coberturas"] as const;
export type LibraryFilter = (typeof libraryFilters)[number];

const componentLabels: Record<TemplateCost["component_type"], string> = {
  sponge: "Bizcochos",
  filling: "Rellenos",
  coverage: "Coberturas",
};

const filterToComponent: Record<Exclude<LibraryFilter, "todos">, TemplateCost["component_type"]> = {
  bizcochos: "sponge",
  rellenos: "filling",
  coberturas: "coverage",
};

const sizeOrder = ["chica", "mediana", "grande"] as const;
const sizeLabels: Record<(typeof sizeOrder)[number], string> = {
  chica: "Chica",
  mediana: "Mediana",
  grande: "Grande",
};

export function LibraryView({
  templates,
  items,
  scalingRules,
  productionRules,
  filter,
  unavailable,
}: {
  templates: TemplateCost[];
  items: TemplateItem[];
  scalingRules: ScalingRule[];
  productionRules: ProductionRule[];
  filter: LibraryFilter;
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <SectionCard eyebrow="Biblioteca" title="Biblioteca de recetas">
        <EmptyState>
          La biblioteca todavía no está en la base. Ejecutá en Supabase las migraciones
          202610240014 y 202611060015 (ver supabase/README.md) y recargá la página.
        </EmptyState>
      </SectionCard>
    );
  }

  const counts: Record<LibraryFilter, number> = {
    todos: templates.length,
    bizcochos: templates.filter((t) => t.component_type === "sponge").length,
    rellenos: templates.filter((t) => t.component_type === "filling").length,
    coberturas: templates.filter((t) => t.component_type === "coverage").length,
  };
  const visible = filter === "todos" ? templates : templates.filter((t) => t.component_type === filterToComponent[filter]);
  const itemsByTemplate = groupBy(items, (item) => item.template_id);
  const byComponent = groupBy(visible, (template) => template.component_type);

  return (
    <>
      <SectionCard
        eyebrow="Biblioteca"
        title="Biblioteca de recetas"
        description="Bizcochos, rellenos y coberturas base por tamaño y cantidad de pisos. El costo usa siempre el último precio de cada insumo."
      >
        <div className="border-b px-5 py-3">
          <FilterPills
            active={filter}
            hrefFor={(value) => buildHref({ vista: "biblioteca", componente: value })}
            options={[
              { value: "todos", label: "Todo", count: counts.todos },
              { value: "bizcochos", label: "Bizcochos", count: counts.bizcochos },
              { value: "rellenos", label: "Rellenos", count: counts.rellenos },
              { value: "coberturas", label: "Coberturas", count: counts.coberturas },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState>No hay recetas cargadas en la biblioteca.</EmptyState>
        ) : (
          <div className="space-y-8 p-4 sm:p-5">
            {(["sponge", "filling", "coverage"] as const)
              .filter((type) => byComponent.has(type))
              .map((type) => {
                const byName = groupBy(
                  [...byComponent.get(type)!].sort((a, b) => a.sort_order - b.sort_order),
                  (template) => template.name,
                );
                return (
                  <div key={type}>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{componentLabels[type]}</h3>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {[...byName.entries()].map(([name, group]) => (
                        <TemplateCard key={name} name={name} templates={group} itemsByTemplate={itemsByTemplate} />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="Reglas" title="Reglas de producción y escalado" description="Criterios que se aplicaron al cargar las recetas.">
        <div className="grid gap-0 lg:grid-cols-2">
          <RuleList
            title="Escalado entre tamaños"
            rules={scalingRules.map((rule) => ({
              id: rule.id,
              title: `${capitalize(rule.family)} · ${rule.component_name}: ${rule.from_size} → ${rule.to_size}`,
              value: rule.keeps_same_quantity ? "Igual" : rule.factor === null ? "—" : `× ${formatQuantity(rule.factor)}`,
              notes: rule.notes,
              warning: /conflicto|contradice/i.test(rule.notes),
            }))}
          />
          <RuleList
            title="Producción y packaging"
            rules={productionRules.map((rule) => ({
              id: rule.id,
              title: `${capitalize(rule.family)} · ${rule.rule_name}`,
              value: rule.numeric_value === null ? "Pendiente" : `${formatQuantity(rule.numeric_value)} ${rule.value_unit ?? ""}`.trim(),
              notes: rule.notes,
              warning: rule.numeric_value === null,
            }))}
          />
        </div>
      </SectionCard>
    </>
  );
}

function TemplateCard({
  name,
  templates,
  itemsByTemplate,
}: {
  name: string;
  templates: TemplateCost[];
  itemsByTemplate: Map<string, TemplateItem[]>;
}) {
  const byFloors = groupBy(templates, (template) => String(template.floor_count ?? "—"));
  const floorKeys = [...byFloors.keys()].sort();
  const missing = new Set(templates.flatMap((template) => template.missing_price_items ?? []));

  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#fcfaf6] px-4 py-3">
        <h4 className="font-medium">{name}</h4>
        {missing.size > 0 && <StatusBadge tone="warning">Sin precio: {[...missing].join(", ")}</StatusBadge>}
      </header>

      <div className="divide-y">
        {floorKeys.map((floorKey) => {
          const group = byFloors.get(floorKey)!;
          const sizes = sizeOrder.filter((size) => group.some((template) => template.size_code === size));
          const unsized = group.filter((template) => template.size_code === null);
          const columns = [
            ...sizes.map((size) => group.find((template) => template.size_code === size)!),
            ...unsized,
          ];
          const ingredientRows = mergeIngredients(columns.map((template) => itemsByTemplate.get(template.template_id) ?? []));
          const first = columns[0];

          return (
            <div key={floorKey} className="overflow-x-auto">
              {floorKey !== "—" && (
                <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {floorKey} {floorKey === "1" ? "piso" : "pisos"}
                  {first && first.component_type === "sponge" && ` · rinde ${formatQuantity(first.yield_quantity)} ${first.yield_unit}`}
                </p>
              )}
              {ingredientRows.length === 0 ? (
                <p className="px-4 py-3 text-xs text-amber-900">
                  {first?.recipe_is_complete === false ? "Faltan ingredientes y cantidades en el relevamiento." : "Sin ingredientes cargados."}
                </p>
              ) : (
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left font-semibold">Insumo</th>
                      {columns.map((template) => (
                        <th key={template.template_id} className="px-3 py-2 text-right font-semibold">
                          {template.size_code ? sizeLabels[template.size_code] : "Base"}
                          {template.diameter_cm && (
                            <span className="block font-normal normal-case tracking-normal">{formatQuantity(template.diameter_cm)} cm</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientRows.map((row) => (
                      <tr key={row.ingredientId} className="border-t">
                        <td className="px-4 py-1.5">{row.name}</td>
                        {columns.map((template, index) => {
                          const item = row.byColumn[index];
                          return (
                            <td key={template.template_id} className="px-3 py-1.5 text-right tabular-nums" title={item?.quantity_note ?? undefined}>
                              {item ? (
                                <span className={item.effective_unit_cost === null ? "text-amber-900" : ""}>
                                  {formatQuantity(item.quantity)} {unitLabel(item.base_unit)}
                                  {item.quantity_note && <span className="ml-0.5 text-muted-foreground">*</span>}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-[#faf6ee] font-semibold">
                      <td className="px-4 py-2">Costo actual</td>
                      {columns.map((template) => (
                        <td key={template.template_id} className="px-3 py-2 text-right tabular-nums">
                          {template.total_cost !== null ? (
                            formatNullablePrice(template.total_cost)
                          ) : (
                            <span className="font-normal text-amber-900" title={`Conocido: ${formatNullablePrice(template.known_cost)}`}>
                              Incompleto
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          );
        })}
      </div>
      <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">* Pasá el cursor sobre una cantidad para ver su nota.</p>
    </article>
  );
}

function RuleList({
  title,
  rules,
}: {
  title: string;
  rules: { id: string; title: string; value: string; notes: string; warning: boolean }[];
}) {
  return (
    <div className="border-b p-5 lg:border-r lg:last:border-r-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin reglas cargadas.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className={`rounded-xl border px-3 py-2 ${rule.warning ? "border-amber-200 bg-amber-50" : "bg-white"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-sm font-medium">{rule.title}</strong>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{rule.value}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{rule.notes}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function mergeIngredients(columns: TemplateItem[][]) {
  const rows = new Map<string, { ingredientId: string; name: string; sort: number; byColumn: (TemplateItem | undefined)[] }>();
  columns.forEach((columnItems, index) => {
    for (const item of columnItems) {
      if (!rows.has(item.ingredient_id)) {
        rows.set(item.ingredient_id, {
          ingredientId: item.ingredient_id,
          name: item.ingredient_name,
          sort: item.sort_order,
          byColumn: new Array(columns.length).fill(undefined),
        });
      }
      rows.get(item.ingredient_id)!.byColumn[index] = item;
    }
  });
  return [...rows.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "es"));
}

function groupBy<T, K>(values: T[], key: (value: T) => K) {
  const map = new Map<K, T[]>();
  for (const value of values) {
    const k = key(value);
    const list = map.get(k);
    if (list) list.push(value);
    else map.set(k, [value]);
  }
  return map;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
