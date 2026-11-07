import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LibraryView, libraryFilters, type LibraryFilter } from "./_components/library-view";
import {
  ProductsView,
  buildHref,
  productStatusFilters,
  summarizeProducts,
  type ProductStatusFilter,
} from "./_components/products-view";
import { SuppliesView, supplyFilters, type SupplyFilter } from "./_components/supplies-view";
import type {
  CategoryRow,
  IngredientCost,
  ProductCost,
  ProductRow,
  ProductionRule,
  RecipeCostCompleteness,
  RecipeItem,
  RecipeSection,
  ScalingRule,
  TemplateCost,
  TemplateItem,
  VariantRow,
} from "./_components/types";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const views = ["productos", "insumos", "biblioteca"] as const;
type View = (typeof views)[number];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const raw = Array.isArray(value) ? value[0] : value;
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function text(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = pick(params.vista, views, "productos");
  const query = text(params.q);

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

  const [
    { data: ingredients },
    { data: productCosts },
    { data: recipeItems },
    { data: recipeSections },
    { data: recipeCostCompleteness },
    { data: products },
    { data: variants },
    { data: categories },
    templatesResult,
    templateItemsResult,
    { data: scalingRules },
    { data: productionRules },
  ] = await Promise.all([
    supabase.from("current_ingredient_costs").select("*").order("name"),
    supabase.from("product_costs").select("*").order("product_name"),
    supabase.from("recipe_items_admin").select("*").order("ingredient_name"),
    supabase.from("recipe_sections").select("id,recipe_id,name,sort_order").order("sort_order"),
    supabase.from("recipe_cost_completeness").select("*"),
    supabase.from("products").select("id,name,image,category_id,is_published,sort_order"),
    supabase.from("product_variants").select("id,product_id,code,detail,is_published,sort_order"),
    supabase.from("categories").select("id,name,sort_order"),
    supabase.from("recipe_template_costs").select("*").order("sort_order"),
    supabase.from("recipe_template_items_admin").select("*").order("sort_order"),
    supabase.from("recipe_scaling_rules").select("*").order("family"),
    supabase.from("recipe_production_rules").select("*").order("family"),
  ]);

  const ingredientRows = (ingredients ?? []) as IngredientCost[];
  const productRows = (productCosts ?? []) as ProductCost[];
  const recipeItemRows = (recipeItems ?? []) as RecipeItem[];
  const productList = (products ?? []) as ProductRow[];
  const variantList = (variants ?? []) as VariantRow[];

  const summary = summarizeProducts(productRows, productList, variantList);
  const suppliesWithoutPrice = ingredientRows.filter((row) => row.effective_unit_cost === null).length;
  const syncErrors = ingredientRows.filter((row) => row.last_price_sync_status === "error").length;

  const usage = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of recipeItemRows) {
    const key = `${item.recipe_id}:${item.ingredient_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    usage.set(item.ingredient_id, (usage.get(item.ingredient_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administración</p>
          <h1 className="text-4xl">Panel de Afrikísima</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sesión: {auth.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/presupuestos">Presupuestos personalizados</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export">Descargar Excel</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/api/admin/export/csv?type=recipes">Recetas CSV</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/api/admin/export/csv?type=supplies">Insumos CSV</a>
          </Button>
          <LogoutButton />
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Tamaños en la tienda" value={summary.visible} href={buildHref({ vista: "productos" })} />
        <Kpi label="Costo completo" value={summary.ready} tone="success" href={buildHref({ vista: "productos", estado: "listas" })} />
        <Kpi label="Recetas con faltantes" value={summary.pending} tone={summary.pending ? "warning" : undefined} href={buildHref({ vista: "productos", estado: "pendientes" })} />
        <Kpi label="Precio a actualizar" value={summary.outdated} tone={summary.outdated ? "info" : undefined} href={buildHref({ vista: "productos", estado: "desactualizadas" })} />
        <Kpi
          label="Insumos sin precio"
          value={suppliesWithoutPrice}
          tone={suppliesWithoutPrice ? "warning" : undefined}
          href={buildHref({ vista: "insumos", tipo: "sin-precio" })}
          detail={syncErrors ? `${syncErrors} con error de sincronización` : undefined}
        />
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1 shadow-sm" aria-label="Secciones del panel">
        <Tab href={buildHref({ vista: "productos" })} active={view === "productos"}>Productos</Tab>
        <Tab href={buildHref({ vista: "insumos" })} active={view === "insumos"} badge={suppliesWithoutPrice || undefined}>Insumos</Tab>
        <Tab href={buildHref({ vista: "biblioteca" })} active={view === "biblioteca"}>Biblioteca de recetas</Tab>
      </nav>

      {view === "productos" && (
        <ProductsView
          productCosts={productRows}
          products={productList}
          variants={variantList}
          categories={(categories ?? []) as CategoryRow[]}
          recipeItems={recipeItemRows}
          recipeSections={(recipeSections ?? []) as RecipeSection[]}
          completeness={(recipeCostCompleteness ?? []) as RecipeCostCompleteness[]}
          ingredients={ingredientRows}
          query={query}
          status={pick<ProductStatusFilter>(params.estado, productStatusFilters, "todos")}
        />
      )}

      {view === "insumos" && (
        <SuppliesView
          ingredients={ingredientRows}
          usage={usage}
          query={query}
          filter={pick<SupplyFilter>(params.tipo, supplyFilters, "todos")}
        />
      )}

      {view === "biblioteca" && (
        <LibraryView
          templates={(templatesResult.data ?? []) as TemplateCost[]}
          items={(templateItemsResult.data ?? []) as TemplateItem[]}
          scalingRules={(scalingRules ?? []) as ScalingRule[]}
          productionRules={(productionRules ?? []) as ProductionRule[]}
          filter={pick<LibraryFilter>(params.componente, libraryFilters, "todos")}
          unavailable={Boolean(templatesResult.error || templateItemsResult.error)}
        />
      )}
    </main>
  );
}

const kpiTones = {
  success: "text-emerald-700",
  warning: "text-amber-700",
  info: "text-sky-700",
} as const;

function Kpi({
  label,
  value,
  href,
  tone,
  detail,
}: {
  label: string;
  value: number;
  href: string;
  tone?: keyof typeof kpiTones;
  detail?: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <strong className={`mt-1 block text-2xl font-medium sm:text-3xl tabular-nums ${tone ? kpiTones[tone] : ""}`}>{value}</strong>
      {detail && <span className="mt-0.5 block text-[11px] text-destructive">{detail}</span>}
    </Link>
  );
}

function Tab({ href, active, badge, children }: { href: string; active: boolean; badge?: number; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors ${
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
      {badge !== undefined && (
        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-background/20" : "bg-amber-100 text-amber-900"}`}>{badge}</span>
      )}
    </Link>
  );
}
