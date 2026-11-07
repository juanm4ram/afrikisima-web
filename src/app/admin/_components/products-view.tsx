import Image from "next/image";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { setVariantPublished } from "../actions";
import {
  EmptyState,
  FilterPills,
  SearchBox,
  SectionCard,
  StatusBadge,
  formatNullablePrice,
  normalize,
  type BadgeTone,
} from "./sheet";
import type {
  CategoryRow,
  IngredientCost,
  ProductCost,
  ProductRow,
  RecipeCostCompleteness,
  RecipeItem,
  RecipeSection,
  VariantRow,
} from "./types";
import { VariantEditor } from "./variant-editor";

type VariantStatus = "lista" | "pendiente" | "oculta";

interface VariantModel {
  cost: ProductCost;
  variant?: VariantRow;
  status: VariantStatus;
  isVisible: boolean;
  priceOutdated: boolean;
  missingPriceCount: number;
  hasItems: boolean;
}

interface ProductModel {
  id: string;
  name: string;
  image?: string;
  categoryName?: string;
  categorySort: number;
  sort: number;
  isPublished: boolean;
  variants: VariantModel[];
}

export const productStatusFilters = ["todos", "listas", "pendientes", "desactualizadas", "ocultas"] as const;
export type ProductStatusFilter = (typeof productStatusFilters)[number];

export function ProductsView({
  productCosts,
  products,
  variants,
  categories,
  recipeItems,
  recipeSections,
  completeness,
  ingredients,
  query,
  status,
}: {
  productCosts: ProductCost[];
  products: ProductRow[];
  variants: VariantRow[];
  categories: CategoryRow[];
  recipeItems: RecipeItem[];
  recipeSections: RecipeSection[];
  completeness: RecipeCostCompleteness[];
  ingredients: IngredientCost[];
  query: string;
  status: ProductStatusFilter;
}) {
  const models = buildProductModels(productCosts, products, variants, categories);
  const allVariants = models.flatMap((product) => product.variants);
  const counts: Record<ProductStatusFilter, number> = {
    todos: allVariants.length,
    listas: allVariants.filter((v) => v.status === "lista").length,
    pendientes: allVariants.filter((v) => v.status === "pendiente").length,
    desactualizadas: allVariants.filter((v) => v.priceOutdated).length,
    ocultas: allVariants.filter((v) => v.status === "oculta").length,
  };

  const needle = normalize(query);
  const filtered = models
    .filter((product) => !needle || normalize(product.name).includes(needle) || normalize(product.categoryName ?? "").includes(needle))
    .map((product) => ({
      ...product,
      variants: product.variants.filter((variant) => matchesStatus(variant, status)),
    }))
    .filter((product) => product.variants.length > 0);

  const completenessByVariant = new Map(completeness.map((row) => [row.variant_id, row]));
  const hrefFor = (value: string) => buildHref({ vista: "productos", estado: value, q: query });

  return (
    <SectionCard
      eyebrow="Productos y recetas"
      title="Productos"
      description="Cada producto muestra sus tamaños. Abrí un tamaño para ver la receta, ajustar cantidades y elegir el precio de la tienda."
      aside={<SearchBox defaultValue={query} placeholder="Buscar producto…" hidden={{ vista: "productos", estado: status }} />}
    >
      <div className="border-b px-5 py-3">
        <FilterPills
          active={status}
          hrefFor={hrefFor}
          options={[
            { value: "todos", label: "Todos", count: counts.todos },
            { value: "listas", label: "Listos para publicar", count: counts.listas },
            { value: "pendientes", label: "Con faltantes", count: counts.pendientes },
            { value: "desactualizadas", label: "Precio a actualizar", count: counts.desactualizadas },
            { value: "ocultas", label: "Ocultos en tienda", count: counts.ocultas },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>No hay productos que coincidan con el filtro.</EmptyState>
      ) : (
        <div className="grid gap-4 p-4 sm:p-5">
          {filtered.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="flex items-center gap-4 border-b bg-[#fcfaf6] p-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {product.image && (
                    <Image src={product.image} alt="" fill sizes="64px" className="object-cover" unoptimized />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-medium">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {product.categoryName ?? "Sin categoría"} · {product.variants.length} {product.variants.length === 1 ? "tamaño" : "tamaños"}
                  </p>
                </div>
                {!product.isPublished && <StatusBadge tone="neutral">Producto oculto</StatusBadge>}
              </header>

              <div className="hidden grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(100px,1fr))_minmax(150px,auto)_28px] gap-3 border-b bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>Tamaño</span>
                <span className="text-right">Costo</span>
                <span className="text-right">Sugerido</span>
                <span className="text-right">Personalizado</span>
                <span className="text-right">En tienda</span>
                <span className="text-right">Estado</span>
                <span />
              </div>

              <div className="divide-y">
                {product.variants.map((model) => (
                  <details key={model.cost.variant_id} className="group">
                    <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto_28px] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#fff7e8] md:grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(100px,1fr))_minmax(150px,auto)_28px] [&::-webkit-details-marker]:hidden">
                      <div>
                        <strong className="block font-medium">{model.cost.variant_label}</strong>
                        <span className="text-xs text-muted-foreground">{model.variant?.detail}</span>
                      </div>
                      <Money value={model.cost.total_cost} className="hidden md:block" />
                      <Money value={model.cost.suggested_price} fallback="Pendiente" className="hidden md:block" />
                      <Money value={model.cost.custom_price} fallback="Pendiente" className="hidden md:block" />
                      <div className="hidden text-right tabular-nums md:block">
                        <span className={model.isVisible ? "font-semibold" : "text-muted-foreground line-through"}>
                          {formatPrice(Number(model.cost.published_price))}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">{publishedSourceLabel(model.cost.published_price_source)}</span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <VariantBadges model={model} />
                      </div>
                      <span className="text-center text-lg text-muted-foreground transition-transform group-open:rotate-90">›</span>
                    </summary>

                    <VisibilityBar model={model} />
                    <VariantEditor
                      row={model.cost}
                      items={recipeItems.filter((item) => item.variant_id === model.cost.variant_id)}
                      sections={recipeSections.filter((section) => section.recipe_id === model.cost.recipe_id)}
                      completeness={completenessByVariant.get(model.cost.variant_id)}
                      ingredients={ingredients}
                    />
                  </details>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function VariantBadges({ model }: { model: VariantModel }) {
  const badges: { tone: BadgeTone; label: string }[] = [];
  if (!model.isVisible) badges.push({ tone: "neutral", label: "Oculta" });
  if (!model.hasItems) badges.push({ tone: "warning", label: "Sin receta" });
  else if (model.missingPriceCount > 0) badges.push({ tone: "warning", label: `${model.missingPriceCount} sin precio` });
  else badges.push({ tone: "success", label: "Costo completo" });
  if (model.priceOutdated) badges.push({ tone: "info", label: "Precio a actualizar" });
  return (
    <>
      {badges.map((badge) => <StatusBadge key={badge.label} tone={badge.tone}>{badge.label}</StatusBadge>)}
    </>
  );
}

function VisibilityBar({ model }: { model: VariantModel }) {
  if (!model.variant) return null;
  const canPublish = Number(model.cost.published_price) > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-3 text-xs sm:px-5">
      <p className="text-muted-foreground">
        {model.isVisible
          ? "Este tamaño se muestra en la tienda."
          : canPublish
            ? "Este tamaño no se muestra en la tienda."
            : "Oculto: elegí un precio (sugerido o personalizado) antes de mostrarlo en la tienda."}
        {model.priceOutdated && (
          <span className="ml-1 font-medium text-sky-800">
            El {model.cost.published_price_source === "custom" ? "personalizado" : "sugerido"} cambió desde la última publicación.
          </span>
        )}
      </p>
      <form action={setVariantPublished}>
        <input type="hidden" name="variant_id" value={model.cost.variant_id} />
        <input type="hidden" name="publish" value={model.variant.is_published ? "0" : "1"} />
        <Button type="submit" size="sm" variant={model.variant.is_published ? "ghost" : "default"} disabled={!model.variant.is_published && !canPublish}>
          {model.variant.is_published ? "Ocultar de la tienda" : "Mostrar en la tienda"}
        </Button>
      </form>
    </div>
  );
}

function Money({ value, fallback = "—", className = "" }: { value: ProductCost["total_cost"]; fallback?: string; className?: string }) {
  return (
    <span className={`text-right tabular-nums ${value === null ? "text-muted-foreground" : ""} ${className}`}>
      {formatNullablePrice(value, fallback)}
    </span>
  );
}

function matchesStatus(variant: VariantModel, status: ProductStatusFilter) {
  switch (status) {
    case "listas":
      return variant.status === "lista";
    case "pendientes":
      return variant.status === "pendiente";
    case "desactualizadas":
      return variant.priceOutdated;
    case "ocultas":
      return variant.status === "oculta";
    default:
      return true;
  }
}

export function summarizeProducts(
  productCosts: ProductCost[],
  products: ProductRow[],
  variants: VariantRow[],
) {
  const all = buildProductModels(productCosts, products, variants, []).flatMap((product) => product.variants);
  return {
    visible: all.filter((v) => v.isVisible).length,
    ready: all.filter((v) => v.status === "lista").length,
    pending: all.filter((v) => v.status === "pendiente").length,
    outdated: all.filter((v) => v.priceOutdated).length,
    hidden: all.filter((v) => v.status === "oculta").length,
  };
}

function buildProductModels(
  productCosts: ProductCost[],
  products: ProductRow[],
  variants: VariantRow[],
  categories: CategoryRow[],
): ProductModel[] {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const grouped = new Map<string, ProductModel>();

  for (const cost of productCosts) {
    const variant = variantById.get(cost.variant_id);
    const productId = variant?.product_id ?? cost.product_name;
    const product = productById.get(productId);
    const category = product ? categoryById.get(product.category_id) : undefined;

    if (!grouped.has(productId)) {
      grouped.set(productId, {
        id: productId,
        name: product?.name ?? cost.product_name,
        image: product?.image,
        categoryName: category?.name,
        categorySort: category?.sort_order ?? 999,
        sort: product?.sort_order ?? 999,
        isPublished: product?.is_published ?? true,
        variants: [],
      });
    }

    const isVisible = (variant?.is_published ?? true) && (product?.is_published ?? true);
    const missingPriceCount = Number(cost.missing_price_count ?? 0);
    const hasItems = Number(cost.item_count ?? 0) > 0;
    const activeChoice =
      cost.published_price_source === "suggested"
        ? cost.suggested_price
        : cost.published_price_source === "custom"
          ? cost.custom_price
          : null;
    const priceOutdated =
      isVisible &&
      activeChoice !== null &&
      Math.round(Number(activeChoice)) !== Math.round(Number(cost.published_price));

    grouped.get(productId)!.variants.push({
      cost,
      variant,
      isVisible,
      missingPriceCount,
      hasItems,
      priceOutdated,
      status: !isVisible ? "oculta" : hasItems && missingPriceCount === 0 ? "lista" : "pendiente",
    });
  }

  const models = [...grouped.values()];
  for (const model of models) {
    model.variants.sort((a, b) => (a.variant?.sort_order ?? 0) - (b.variant?.sort_order ?? 0));
  }
  return models.sort(
    (a, b) => a.categorySort - b.categorySort || a.sort - b.sort || a.name.localeCompare(b.name, "es"),
  );
}

function publishedSourceLabel(source: ProductCost["published_price_source"]) {
  if (source === "suggested") return "Sugerido";
  if (source === "custom") return "Personalizado";
  return "Manual / anterior";
}

export function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "todos") search.set(key, value);
  }
  const text = search.toString();
  return text ? `/admin?${text}` : "/admin";
}
