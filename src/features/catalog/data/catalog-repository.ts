import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Category, Product, SizeId } from "../types";
import { getCatalog as getLocalCatalog } from "./products";

interface CatalogRow {
  category_id: string;
  category_name: string;
  category_sort: number;
  product_id: string;
  product_slug: string;
  product_name: string;
  product_description: string;
  product_image: string;
  product_gallery: string[] | null;
  product_tags: string[] | null;
  product_sort: number;
  size_id: string;
  size_label: string;
  size_detail: string;
  size_price: number | string;
  size_sort: number;
}

export type CatalogSource = "supabase" | "local-catalog" | "local-catalog-fallback";

export interface CatalogResult {
  categories: Category[];
  products: Product[];
  source: CatalogSource;
}

function localResult(source: CatalogSource): CatalogResult {
  return { ...getLocalCatalog(), source };
}

function sizeId(value: string): SizeId {
  if (value !== "mediano" && value !== "grande") {
    throw new Error("Tamaño de catálogo no reconocido: " + value);
  }
  return value;
}

function rowsToCatalog(rows: CatalogRow[]): Omit<CatalogResult, "source"> {
  const categoryMap = new Map<string, Category & { sort: number }>();
  const productMap = new Map<string, Product & { sort: number }>();

  for (const row of rows) {
    if (!categoryMap.has(row.category_id)) {
      categoryMap.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        sort: row.category_sort,
      });
    }

    const existing = productMap.get(row.product_id);
    if (existing) {
      existing.sizes.push({
        id: sizeId(row.size_id),
        label: row.size_label,
        detail: row.size_detail,
        price: Number(row.size_price),
      });
      continue;
    }

    productMap.set(row.product_id, {
      id: row.product_id,
      slug: row.product_slug,
      name: row.product_name,
      description: row.product_description,
      categoryId: row.category_id,
      image: row.product_image,
      gallery: row.product_gallery ?? undefined,
      tags: row.product_tags ?? undefined,
      sizes: [
        {
          id: sizeId(row.size_id),
          label: row.size_label,
          detail: row.size_detail,
          price: Number(row.size_price),
        },
      ],
      sort: row.product_sort,
    });
  }

  const categories = [...categoryMap.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _sort, ...category }) => category);
  const products = [...productMap.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _sort, ...product }) => product);

  return { categories, products };
}

export async function loadCatalog(): Promise<CatalogResult> {
  const config = getSupabaseConfig();
  if (!config) return localResult("local-catalog");

  const supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("get_public_catalog");

  if (error || !Array.isArray(data) || data.length === 0) {
    console.error("No se pudo leer el catálogo de Supabase", error);
    return localResult("local-catalog-fallback");
  }

  try {
    return { ...rowsToCatalog(data as CatalogRow[]), source: "supabase" };
  } catch (error) {
    console.error("El catálogo de Supabase tiene datos inválidos", error);
    return localResult("local-catalog-fallback");
  }
}
