-- Afrikísima: reglas del relevamiento del 2026-11-06.
-- Ejecutar después de 202610240014_recipe_library_sizes_and_prices.sql.
--
-- La migración 14 ya cargó bizcochos, rellenos, coberturas, packaging por
-- tamaño y la caja de 30 cm a $2.700. Esta migración agrega lo que faltaba:
--   1. Tiramisú SÍ tiene tamaño chico: se crea la variante y su receta como la
--      mitad de la grande. Queda oculta en la tienda hasta que tenga precio y
--      packaging, y se publica desde el panel.
--   2. Ninguna tarta tiene tamaño chico: si existiera alguna variante chica de
--      tarta, se oculta.
--   3. Vista de detalle de la biblioteca de recetas para el panel.
-- Es segura de reejecutar: no pisa cantidades que el administrador ya editó.

-- ---------------------------------------------------------------------------
-- 1. Tiramisú chico
-- ---------------------------------------------------------------------------

insert into public.product_variants (
  id, product_id, code, label, detail, published_price, sort_order, is_published
)
values (
  'tiramisu-chico', 'tiramisu', 'chico', 'Chica',
  'Mitad de la receta grande', 0, 5, false
)
on conflict (id) do update set
  label = excluded.label,
  detail = excluded.detail,
  sort_order = excluded.sort_order;

insert into public.recipes (
  variant_id, name, yield_quantity, servings,
  target_margin_percent, rounding_increment, notes
)
select
  'tiramisu-chico',
  'Tiramisú · Chica',
  1,
  greatest(1, round(coalesce(large_recipe.servings, 20) / 2.0)::integer),
  coalesce(large_recipe.target_margin_percent, 30),
  coalesce(large_recipe.rounding_increment, 500),
  'Relevamiento 2026-11-06: la chica usa la mitad de la grande. '
    || 'La fuente también dice “de la mediana a la chica, 1/3 menos”, pero como la '
    || 'mediana (22 cm) usa la misma cantidad que la grande (24 cm), ambas reglas no '
    || 'pueden cumplirse a la vez; se aplica la mitad. Packaging y porciones a confirmar.'
from public.product_variants large_variant
left join public.recipes large_recipe on large_recipe.variant_id = large_variant.id
where large_variant.id = 'tiramisu-grande'
on conflict (variant_id) do nothing;

-- Copia las secciones de la grande (Bizcocho, Relleno, Cobertura, Packaging...).
insert into public.recipe_sections (recipe_id, name, sort_order)
select small_recipe.id, large_section.name, large_section.sort_order
from public.recipes small_recipe
join public.recipes large_recipe on large_recipe.variant_id = 'tiramisu-grande'
join public.recipe_sections large_section on large_section.recipe_id = large_recipe.id
where small_recipe.variant_id = 'tiramisu-chico'
on conflict (recipe_id, name) do nothing;

insert into public.recipe_sections (recipe_id, name, sort_order)
select id, 'Packaging', 40
from public.recipes
where variant_id = 'tiramisu-chico'
on conflict (recipe_id, name) do nothing;

-- Ingredientes = mitad de la grande. Solo se cargan si la chica todavía no
-- tiene ingredientes, para no pisar ajustes hechos desde el panel.
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  small_recipe.id,
  small_section.id,
  large_item.ingredient_id,
  round(large_item.quantity * 0.5, 3),
  concat_ws(
    ' ',
    nullif(large_item.quantity_note, ''),
    'Chica: mitad de la grande.'
  )
from public.recipes small_recipe
join public.recipes large_recipe on large_recipe.variant_id = 'tiramisu-grande'
join public.recipe_items large_item on large_item.recipe_id = large_recipe.id
join public.ingredients supply
  on supply.id = large_item.ingredient_id
  and supply.supply_type = 'ingredient'
join public.recipe_sections large_section on large_section.id = large_item.section_id
join public.recipe_sections small_section
  on small_section.recipe_id = small_recipe.id
  and small_section.name = large_section.name
where small_recipe.variant_id = 'tiramisu-chico'
  and round(large_item.quantity * 0.5, 3) > 0
  and not exists (
    select 1
    from public.recipe_items existing
    join public.ingredients existing_supply on existing_supply.id = existing.ingredient_id
    where existing.recipe_id = small_recipe.id
      and existing_supply.supply_type = 'ingredient'
  )
on conflict (recipe_id, section_id, ingredient_id) do nothing;

update public.recipe_scaling_rules
set
  notes = 'La chica usa 1/3 menos que la mediana según la fuente. Como la mediana usa '
    || 'la misma cantidad que la grande, esto contradice la regla de la mitad; '
    || 'se aplica la mitad de la grande (receta Tiramisú · Chica).',
  updated_at = now()
where id = 'tiramisu-medium-small';

insert into public.recipe_production_rules (
  id, family, rule_name, numeric_value, value_unit, notes
)
values (
  'tiramisu-small-size', 'tiramisu', 'Tamaño chico de tiramisú', 0.5, 'factor',
  'El tiramisú es la única excepción con tamaño chico: mitad de la receta grande.'
)
on conflict (id) do update set
  numeric_value = excluded.numeric_value,
  value_unit = excluded.value_unit,
  notes = excluded.notes,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Tartas sin tamaño chico
-- ---------------------------------------------------------------------------

update public.product_variants
set is_published = false
where product_id in ('ricota', 'cheesecake-ny', 'lemon-pie', 'frutilla')
  and code in ('chico', 'chica');

-- ---------------------------------------------------------------------------
-- 3. Detalle de la biblioteca para el panel
-- ---------------------------------------------------------------------------

create or replace view public.recipe_template_items_admin
with (security_invoker = true)
as
select
  item.id,
  item.template_id,
  item.sort_order,
  item.quantity,
  item.quantity_note,
  ingredient.id as ingredient_id,
  ingredient.name as ingredient_name,
  ingredient.base_unit,
  cost.effective_unit_cost,
  case
    when cost.effective_unit_cost is null then null
    else round(item.quantity * cost.effective_unit_cost, 2)
  end as line_cost
from public.recipe_template_items item
join public.ingredients ingredient on ingredient.id = item.ingredient_id
left join public.current_ingredient_costs cost on cost.id = item.ingredient_id;

grant select on public.recipe_template_items_admin to authenticated;

comment on view public.recipe_template_items_admin is
  'Renglones de cada plantilla de la biblioteca con su costo vigente.';
