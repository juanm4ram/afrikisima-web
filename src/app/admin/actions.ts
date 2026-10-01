"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function numberField(form: FormData, name: string) {
  const value = Number(String(form.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value)) throw new Error("Valor inválido: " + name);
  return value;
}

function optionalNumberField(form: FormData, name: string) {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) throw new Error("Valor inválido: " + name);
  return value;
}

function optionalTextField(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim() || null;
}

function integerField(form: FormData, name: string) {
  const value = numberField(form, name);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Debe ser un número entero mayor que cero: " + name);
  }
  return value;
}

function purchaseConversion(form: FormData) {
  const explicit = optionalNumberField(form, "conversion_to_base");
  if (explicit !== null) {
    if (explicit <= 0) throw new Error("La equivalencia debe ser mayor que cero");
    return explicit;
  }

  const baseUnit = String(form.get("base_unit") ?? "");
  const purchaseUnit = String(form.get("purchase_unit") ?? "");
  const conversions: Record<string, number> = {
    "g:g": 1,
    "g:kg": 1000,
    "ml:ml": 1,
    "ml:l": 1000,
    "unit:unit": 1,
  };
  const conversion = conversions[`${baseUnit}:${purchaseUnit}`];
  if (!conversion) {
    throw new Error("Indicá a cuántas unidades base equivale la unidad de compra");
  }
  return conversion;
}

async function adminClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está configurado");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");

  const { data: allowed, error } = await supabase.rpc("is_admin");
  if (error || !allowed) throw new Error("La cuenta no tiene permisos de administración");
  return supabase;
}

export async function addSupply(form: FormData) {
  const supabase = await adminClient();
  const supplyType = String(form.get("supply_type") ?? "ingredient");
  const isPackaging = supplyType === "packaging";
  const name = String(form.get("name") ?? "").trim();
  const sizeLabel = String(form.get("size_label") ?? "").trim();
  if (!isPackaging && supplyType !== "ingredient") throw new Error("Tipo de insumo inválido");
  if (!name) throw new Error("El insumo necesita un nombre");
  if (isPackaging && !sizeLabel) throw new Error("El packaging necesita un tamaño");

  const { error } = await supabase.rpc("add_supply_with_price", {
    supply_name: name,
    new_supply_type: supplyType,
    supply_size_label: isPackaging ? sizeLabel : null,
    supply_base_unit: isPackaging ? "unit" : String(form.get("base_unit") ?? "g"),
    initial_package_quantity: isPackaging ? 1 : numberField(form, "package_quantity"),
    initial_package_price: numberField(form, "package_price"),
    supply_purchase_unit: isPackaging ? "unit" : String(form.get("purchase_unit") ?? ""),
    supply_conversion_to_base: isPackaging ? 1 : purchaseConversion(form),
    price_supplier: isPackaging ? null : optionalTextField(form, "supplier"),
    price_brand: isPackaging ? null : optionalTextField(form, "brand"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function recordIngredientPrice(form: FormData) {
  const supabase = await adminClient();
  const conversionToBase = purchaseConversion(form);
  const { error } = await supabase.rpc("record_ingredient_price", {
    target_ingredient_id: String(form.get("ingredient_id")),
    new_package_quantity: numberField(form, "package_quantity"),
    new_package_price: numberField(form, "package_price"),
    new_purchase_unit: String(form.get("purchase_unit") ?? ""),
    new_conversion_to_base: conversionToBase,
    price_supplier: String(form.get("supplier") ?? "").trim() || null,
    price_brand: String(form.get("brand") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function publishSuggestedPrices() {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("publish_suggested_prices");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateRecipeSettings(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("upsert_recipe_settings", {
    target_variant_id: String(form.get("variant_id")),
    new_yield_quantity: numberField(form, "yield_quantity"),
    new_servings: integerField(form, "servings"),
    new_target_margin_percent: numberField(form, "target_margin_percent"),
    new_rounding_increment: numberField(form, "rounding_increment"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setRecipeItem(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("set_recipe_item", {
    target_variant_id: String(form.get("variant_id")),
    target_ingredient_id: String(form.get("ingredient_id")),
    required_quantity: numberField(form, "quantity"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteRecipeItem(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("recipe_items")
    .delete()
    .eq("id", String(form.get("recipe_item_id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/presupuestos");
}

export async function createCustomBudget(form: FormData) {
  const supabase = await adminClient();
  const name = String(form.get("name") ?? "").trim();
  if (!name) throw new Error("El presupuesto necesita un nombre");

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      variant_id: null,
      name,
      customer_name: optionalTextField(form, "customer_name"),
      event_date: optionalTextField(form, "event_date"),
      mold_size: optionalTextField(form, "mold_size"),
      presentation: optionalTextField(form, "presentation"),
      quoted_price: optionalNumberField(form, "quoted_price"),
      yield_quantity: numberField(form, "yield_quantity"),
      servings: integerField(form, "servings"),
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: sectionsError } = await supabase.from("recipe_sections").insert([
    { recipe_id: recipe.id, name: "Bizcocho", sort_order: 10 },
    { recipe_id: recipe.id, name: "Relleno", sort_order: 20 },
    { recipe_id: recipe.id, name: "Cobertura", sort_order: 30 },
    { recipe_id: recipe.id, name: "Packaging", sort_order: 40 },
  ]);
  if (sectionsError) throw new Error(sectionsError.message);
  revalidatePath("/admin/presupuestos");
}

export async function updateCustomBudget(form: FormData) {
  const supabase = await adminClient();
  const recipeId = String(form.get("recipe_id"));
  const { error } = await supabase
    .from("recipes")
    .update({
      name: String(form.get("name") ?? "").trim(),
      customer_name: optionalTextField(form, "customer_name"),
      event_date: optionalTextField(form, "event_date"),
      mold_size: optionalTextField(form, "mold_size"),
      presentation: optionalTextField(form, "presentation"),
      quoted_price: optionalNumberField(form, "quoted_price"),
      yield_quantity: numberField(form, "yield_quantity"),
      servings: integerField(form, "servings"),
      target_margin_percent: numberField(form, "target_margin_percent"),
      rounding_increment: numberField(form, "rounding_increment"),
      status: String(form.get("status") ?? "draft"),
      notes: optionalTextField(form, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .is("variant_id", null);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/presupuestos");
}

export async function addBudgetSection(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("recipe_sections").insert({
    recipe_id: String(form.get("recipe_id")),
    name: String(form.get("name") ?? "").trim(),
    sort_order: numberField(form, "sort_order"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/presupuestos");
}

export async function setBudgetRecipeItem(form: FormData) {
  const supabase = await adminClient();
  const recipeId = String(form.get("recipe_id"));
  const sectionId = String(form.get("section_id"));
  const ingredientId = String(form.get("ingredient_id"));
  const { error } = await supabase.from("recipe_items").upsert(
    {
      recipe_id: recipeId,
      section_id: sectionId,
      ingredient_id: ingredientId,
      quantity: numberField(form, "quantity"),
      quantity_note: optionalTextField(form, "quantity_note"),
    },
    { onConflict: "recipe_id,section_id,ingredient_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/presupuestos");
}
