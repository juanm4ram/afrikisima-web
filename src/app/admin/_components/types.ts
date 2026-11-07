export type Numeric = number | string;

export interface IngredientCost {
  id: string;
  name: string;
  base_unit: string;
  supply_type: "ingredient" | "packaging";
  size_label: string | null;
  package_quantity: Numeric | null;
  package_price: Numeric | null;
  purchase_unit: string | null;
  conversion_to_base: Numeric | null;
  brand: string | null;
  supplier: string | null;
  effective_unit_cost: Numeric | null;
  price_change_percent: Numeric | null;
  source_url: string | null;
  source_notes?: string | null;
  auto_update_enabled: boolean;
  last_price_sync_at: string | null;
  last_price_sync_status: "ok" | "unchanged" | "error" | null;
  last_price_sync_message: string | null;
}

export interface ProductCost {
  variant_id: string;
  product_name: string;
  variant_label: string;
  published_price: Numeric;
  published_price_source: "manual" | "suggested" | "custom";
  published_price_updated_at: string | null;
  recipe_id: string | null;
  item_count: Numeric | null;
  priced_item_count: Numeric | null;
  missing_price_count: Numeric | null;
  known_supply_cost: Numeric | null;
  suggested_price: Numeric | null;
  unrounded_suggested_price: Numeric | null;
  yield_quantity: Numeric | null;
  target_margin_percent: Numeric | null;
  rounding_increment: Numeric | null;
  total_cost: Numeric | null;
  servings: Numeric | null;
  cost_per_serving: Numeric | null;
  suggested_price_per_serving: Numeric | null;
  custom_profit_type: "percent" | "amount" | null;
  custom_profit_value: Numeric | null;
  custom_profit_amount: Numeric | null;
  custom_price: Numeric | null;
  custom_price_per_serving: Numeric | null;
  notes: string | null;
}

export interface RecipeItem {
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
  quantity: Numeric;
  quantity_note: string | null;
  effective_unit_cost: Numeric | null;
  line_cost: Numeric | null;
}

export interface RecipeSection {
  id: string;
  recipe_id: string;
  name: string;
  sort_order: number;
}

export interface RecipeCostCompleteness {
  recipe_id: string;
  variant_id: string;
  ingredient_item_count: Numeric;
  packaging_item_count: Numeric;
  missing_price_count: Numeric;
  ingredient_cost: Numeric;
  packaging_cost: Numeric;
  total_known_supply_cost: Numeric;
  is_complete: boolean;
}

export interface ProductRow {
  id: string;
  name: string;
  image: string;
  category_id: string;
  is_published: boolean;
  sort_order: number;
}

export interface VariantRow {
  id: string;
  product_id: string;
  code: string;
  detail: string;
  is_published: boolean;
  sort_order: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

export interface TemplateCost {
  template_id: string;
  family: string;
  component_type: "sponge" | "filling" | "coverage";
  name: string;
  size_code: "chica" | "mediana" | "grande" | null;
  diameter_cm: Numeric | null;
  floor_count: number | null;
  yield_quantity: Numeric;
  yield_unit: string;
  sort_order: number;
  recipe_is_complete: boolean;
  item_count: Numeric;
  missing_price_count: Numeric;
  missing_price_items: string[];
  known_cost: Numeric;
  total_cost: Numeric | null;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  sort_order: number;
  quantity: Numeric;
  quantity_note: string | null;
  ingredient_id: string;
  ingredient_name: string;
  base_unit: string;
  effective_unit_cost: Numeric | null;
  line_cost: Numeric | null;
}

export interface ScalingRule {
  id: string;
  family: string;
  component_name: string;
  from_size: string;
  to_size: string;
  factor: Numeric | null;
  keeps_same_quantity: boolean;
  notes: string;
}

export interface ProductionRule {
  id: string;
  family: string;
  rule_name: string;
  numeric_value: Numeric | null;
  value_unit: string | null;
  notes: string;
}
