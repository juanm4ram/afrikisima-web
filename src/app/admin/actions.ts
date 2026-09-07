"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function numberField(form: FormData, name: string) {
  const value = Number(String(form.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value)) throw new Error("Valor inválido: " + name);
  return value;
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
}
