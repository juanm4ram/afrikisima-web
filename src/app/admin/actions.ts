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

async function adminClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está configurado");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");

  const { data: allowed, error } = await supabase.rpc("is_admin");
  if (error || !allowed) throw new Error("La cuenta no tiene permisos de administración");
  return supabase;
}

export async function addIngredient(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("add_ingredient_with_price", {
    ingredient_name: String(form.get("name") ?? "").trim(),
    ingredient_unit: String(form.get("base_unit") ?? "g"),
    ingredient_waste_percent: numberField(form, "waste_percent"),
    initial_package_quantity: numberField(form, "package_quantity"),
    initial_package_price: numberField(form, "package_price"),
    price_supplier: String(form.get("supplier") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function recordIngredientPrice(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("record_ingredient_price", {
    target_ingredient_id: String(form.get("ingredient_id")),
    new_package_quantity: numberField(form, "package_quantity"),
    new_package_price: numberField(form, "package_price"),
    price_supplier: String(form.get("supplier") ?? "").trim() || null,
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
    new_labor_cost: numberField(form, "labor_cost"),
    new_packaging_cost: numberField(form, "packaging_cost"),
    new_overhead_percent: numberField(form, "overhead_percent"),
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
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: sectionsError } = await supabase.from("recipe_sections").insert([
    { recipe_id: recipe.id, name: "Bizcocho", sort_order: 10 },
    { recipe_id: recipe.id, name: "Relleno", sort_order: 20 },
    { recipe_id: recipe.id, name: "Cobertura", sort_order: 30 },
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
      labor_cost: numberField(form, "labor_cost"),
      packaging_cost: numberField(form, "packaging_cost"),
      overhead_percent: numberField(form, "overhead_percent"),
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

export async function addBudgetExtra(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("recipe_extras").insert({
    recipe_id: String(form.get("recipe_id")),
    kind: String(form.get("kind") ?? "presentation"),
    name: String(form.get("name") ?? "").trim(),
    amount: numberField(form, "amount"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/presupuestos");
}

export async function deleteBudgetExtra(form: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("recipe_extras")
    .delete()
    .eq("id", String(form.get("extra_id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/presupuestos");
}
