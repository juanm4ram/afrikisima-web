-- Afrikísima: precarga de recetas publicadas a partir de las planillas históricas.
-- Ejecutar después de 202609300007_reference_supplies_and_price_sources.sql.
-- Las cantidades se toman de los archivos de recetas; los precios siempre se
-- resuelven desde el último registro de public.ingredient_prices.

-- Las planillas expresan el jugo en ml y la ralladura en gramos. Se normalizan
-- esas unidades para que las cantidades de receta sean comparables.
update public.ingredients
set base_unit = 'ml', updated_at = now()
where name = 'Jugo de limón' and base_unit <> 'ml';

update public.ingredients
set base_unit = 'g', updated_at = now()
where name = 'Ralladura de limón' and base_unit <> 'g';

-- El colorante negro figura como C/N en la receta Vintage. Se incorpora sin
-- precio: el precio sugerido quedará pendiente hasta que el administrador lo cargue.
insert into public.ingredients (name, base_unit, supply_type, source_notes)
values (
  'Colorante negro', 'g', 'ingredient',
  'Figura como C/N en la receta Torta Vintage; requiere precio y cantidad de uso revisada.'
)
on conflict (name) do nothing;

create temporary table catalog_recipe_sources (
  product_id text primary key,
  source_reference text not null,
  source_diameter_cm numeric(8, 3) not null
) on commit drop;

insert into catalog_recipe_sources values
  ('personalizada', 'Torta Delfi Muiño', 16),
  ('burn-away', 'Torta Burn Away Cake · cobertura buttercream', 24),
  ('glitter', 'Glitter Cake', 24),
  ('vintage', 'Torta Vintage', 20),
  ('fondant', 'Torta Fondant', 24),
  ('tiramisu', 'Tiramisú', 17),
  ('ricota', 'Tarta de ricota', 24),
  ('lemon-pie', 'Lemon Pie', 24);

create temporary table catalog_recipe_variants as
select
  v.id as variant_id,
  v.product_id,
  p.name as product_name,
  v.label as variant_label,
  s.source_reference,
  s.source_diameter_cm,
  case v.code when 'mediano' then 18::numeric else 24::numeric end as target_diameter_cm,
  power(
    (case v.code when 'mediano' then 18::numeric else 24::numeric end)
      / s.source_diameter_cm,
    2
  ) as scale_factor,
  case v.code when 'mediano' then 12 else 20 end as servings
from public.product_variants v
join public.products p on p.id = v.product_id
join catalog_recipe_sources s on s.product_id = v.product_id
where p.is_published and v.is_published;

-- Primero crea las recetas respaldadas por las planillas. No pisa ajustes ni
-- cantidades si la receta ya había sido modificada por el administrador.
insert into public.recipes (
  variant_id, name, yield_quantity, servings,
  target_margin_percent, rounding_increment, notes
)
select
  variant_id,
  product_name || ' · ' || variant_label,
  1,
  servings,
  30,
  500,
  'Fuente: ' || source_reference || '. Cantidades escaladas por superficie desde '
    || trim(to_char(source_diameter_cm, 'FM999990.###')) || ' cm a '
    || trim(to_char(target_diameter_cm, 'FM999990.###')) || ' cm (factor '
    || trim(to_char(scale_factor, 'FM999990.###')) || ').'
from catalog_recipe_variants
on conflict (variant_id) do nothing;

-- También crea una ficha editable para cada variante publicada sin receta fuente.
insert into public.recipes (
  variant_id, name, yield_quantity, servings,
  target_margin_percent, rounding_increment, notes
)
select
  v.id,
  p.name || ' · ' || v.label,
  1,
  case v.code when 'mediano' then 12 else 20 end,
  30,
  500,
  'Pendiente: los archivos proporcionados no contienen una receta equivalente para este producto.'
from public.product_variants v
join public.products p on p.id = v.product_id
where p.is_published and v.is_published
on conflict (variant_id) do nothing;

insert into public.recipe_sections (recipe_id, name, sort_order)
select r.id, section_data.name, section_data.sort_order
from public.recipes r
join catalog_recipe_variants seeded on seeded.variant_id = r.variant_id
cross join (values
  ('Bizcocho', 10),
  ('Relleno', 20),
  ('Cobertura', 30),
  ('Packaging', 40)
) as section_data(name, sort_order)
on conflict (recipe_id, name) do nothing;

insert into public.recipe_sections (recipe_id, name, sort_order)
select r.id, 'General', 0
from public.recipes r
join public.product_variants v on v.id = r.variant_id
join public.products p on p.id = v.product_id
where p.is_published
  and v.is_published
  and not exists (
    select 1 from catalog_recipe_variants seeded where seeded.variant_id = r.variant_id
  )
on conflict (recipe_id, name) do nothing;

insert into public.recipe_sections (recipe_id, name, sort_order)
select r.id, 'Packaging', 40
from public.recipes r
join public.product_variants v on v.id = r.variant_id
join public.products p on p.id = v.product_id
where p.is_published and v.is_published
on conflict (recipe_id, name) do nothing;

create temporary table catalog_recipe_source_items (
  product_id text not null,
  section_name text not null,
  ingredient_name text not null,
  source_quantity numeric(12, 6) not null,
  quantity_note text,
  primary key (product_id, section_name, ingredient_name)
) on commit drop;

insert into catalog_recipe_source_items values
  -- Torta Personalizada: referencia Torta Delfi Muiño, 16 cm.
  ('personalizada', 'Bizcocho', 'Harina 0000', 250, null),
  ('personalizada', 'Bizcocho', 'Aceite', 160, null),
  ('personalizada', 'Bizcocho', 'Azúcar', 180, null),
  ('personalizada', 'Bizcocho', 'Huevos', 3, 'Fuente: 165 g; convertido a 3 huevos de 55 g antes de escalar.'),
  ('personalizada', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('personalizada', 'Bizcocho', 'Leche', 160, null),
  ('personalizada', 'Bizcocho', 'Polvo de hornear', 18.6, null),
  ('personalizada', 'Relleno', 'Dulce de leche repostero', 400, null),
  ('personalizada', 'Cobertura', 'Manteca', 600, null),
  ('personalizada', 'Cobertura', 'Azúcar', 600, null),
  ('personalizada', 'Cobertura', 'Claras de huevo', 300, null),

  -- Burn Away Cake: se toma la alternativa de buttercream de la planilla.
  ('burn-away', 'Bizcocho', 'Huevos', 7.272727, 'Fuente: 400 g; convertido con 55 g por huevo antes de escalar.'),
  ('burn-away', 'Bizcocho', 'Harina 0000', 400, null),
  ('burn-away', 'Bizcocho', 'Azúcar', 400, null),
  ('burn-away', 'Bizcocho', 'Manteca', 400, null),
  ('burn-away', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('burn-away', 'Relleno', 'Crema para batir', 350, null),
  ('burn-away', 'Relleno', 'Chocolate Aguila', 150, null),
  ('burn-away', 'Relleno', 'Duraznos en almíbar', 410, null),
  ('burn-away', 'Relleno', 'Gelatina sin sabor', 9, null),
  ('burn-away', 'Relleno', 'Huevos', 1, 'Fuente: 55 g, equivalente a 1 huevo.'),
  ('burn-away', 'Relleno', 'Yemas', 0.75, 'La fuente indica “3/4 gr”; revisar esta cantidad en el panel.'),
  ('burn-away', 'Relleno', 'Azúcar', 75, null),
  ('burn-away', 'Cobertura', 'Manteca', 900, null),
  ('burn-away', 'Cobertura', 'Claras de huevo', 300, null),
  ('burn-away', 'Cobertura', 'Azúcar', 600, null),
  ('burn-away', 'Cobertura', 'Agua', 200, null),
  ('burn-away', 'Cobertura', 'Esencia de vainilla', 15, null),
  ('burn-away', 'Cobertura', 'Papel de arroz', 2, null),

  -- Glitter Cake, 24 cm.
  ('glitter', 'Bizcocho', 'Huevos', 7.272727, 'Fuente: 400 g; convertido con 55 g por huevo antes de escalar.'),
  ('glitter', 'Bizcocho', 'Harina 0000', 400, null),
  ('glitter', 'Bizcocho', 'Azúcar', 400, null),
  ('glitter', 'Bizcocho', 'Manteca', 400, null),
  ('glitter', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('glitter', 'Relleno', 'Duraznos en almíbar', 410, null),
  ('glitter', 'Relleno', 'Crema para batir', 200, null),
  ('glitter', 'Relleno', 'Dulce de leche repostero', 200, null),
  ('glitter', 'Cobertura', 'Manteca', 900, null),
  ('glitter', 'Cobertura', 'Claras de huevo', 300, null),
  ('glitter', 'Cobertura', 'Azúcar', 600, null),
  ('glitter', 'Cobertura', 'Agua', 200, null),
  ('glitter', 'Cobertura', 'Esencia de vainilla', 15, null),
  ('glitter', 'Cobertura', 'Colorante rosa', 1, null),

  -- Torta Vintage, 20 cm.
  ('vintage', 'Bizcocho', 'Manteca', 90, null),
  ('vintage', 'Bizcocho', 'Azúcar mascabo', 188, null),
  ('vintage', 'Bizcocho', 'Huevos', 3, 'Fuente: 165 g; convertido a 3 huevos de 55 g antes de escalar.'),
  ('vintage', 'Bizcocho', 'Harina 0000', 188, null),
  ('vintage', 'Bizcocho', 'Polvo de hornear', 15.52, null),
  ('vintage', 'Bizcocho', 'Leche', 40, null),
  ('vintage', 'Bizcocho', 'Aceite', 90, null),
  ('vintage', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('vintage', 'Relleno', 'Azúcar', 120, null),
  ('vintage', 'Relleno', 'Crema para batir', 180, null),
  ('vintage', 'Relleno', 'Yemas', 40, null),
  ('vintage', 'Relleno', 'Manteca', 40, null),
  ('vintage', 'Relleno', 'Agua', 200, null),
  ('vintage', 'Relleno', 'Gelatina sin sabor', 2, null),
  ('vintage', 'Cobertura', 'Manteca', 600, null),
  ('vintage', 'Cobertura', 'Azúcar', 600, null),
  ('vintage', 'Cobertura', 'Claras de huevo', 300, null),
  ('vintage', 'Cobertura', 'Esencia de vainilla', 15, null),
  ('vintage', 'Cobertura', 'Colorante negro', 1, 'C/N en la fuente; 1 g es un valor inicial editable.'),

  -- Torta Fondant. La planilla no indica diámetro; se usa 24 cm por equivalencia
  -- con la fórmula de bizcocho de la Torta Martín del mismo archivo.
  ('fondant', 'Bizcocho', 'Harina 0000', 300, null),
  ('fondant', 'Bizcocho', 'Aceite', 210, null),
  ('fondant', 'Bizcocho', 'Polvo de hornear', 19, null),
  ('fondant', 'Bizcocho', 'Huevos', 3.909091, 'Fuente: 215 g; convertido con 55 g por huevo antes de escalar.'),
  ('fondant', 'Bizcocho', 'Leche', 210, null),
  ('fondant', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('fondant', 'Bizcocho', 'Azúcar', 230, null),
  ('fondant', 'Relleno', 'Chocolate blanco', 100, null),
  ('fondant', 'Relleno', 'Crema para batir', 430, null),
  ('fondant', 'Relleno', 'Duraznos en almíbar', 486, null),
  ('fondant', 'Cobertura', 'Claras de huevo', 180, null),
  ('fondant', 'Cobertura', 'Azúcar', 360, null),
  ('fondant', 'Cobertura', 'Manteca', 540, 'La planilla no detalla el fondant como insumo separado.'),

  -- Tiramisú, 17 cm.
  ('tiramisu', 'Bizcocho', 'Harina 0000', 75, null),
  ('tiramisu', 'Bizcocho', 'Yemas', 54, null),
  ('tiramisu', 'Bizcocho', 'Claras de huevo', 105, null),
  ('tiramisu', 'Bizcocho', 'Azúcar', 75, null),
  ('tiramisu', 'Bizcocho', 'Azúcar impalpable', 5, null),
  ('tiramisu', 'Bizcocho', 'Esencia de vainilla', 15, null),
  ('tiramisu', 'Relleno', 'Yemas', 50, null),
  ('tiramisu', 'Relleno', 'Azúcar', 50, null),
  ('tiramisu', 'Relleno', 'Agua', 15, null),
  ('tiramisu', 'Relleno', 'Crema para batir', 50, null),
  ('tiramisu', 'Relleno', 'Gelatina sin sabor', 6, null),
  ('tiramisu', 'Relleno', 'Queso mascarpone', 325, null),
  ('tiramisu', 'Relleno', 'Café', 250, null),
  ('tiramisu', 'Cobertura', 'Cacao amargo', 10, null),

  -- Tarta de Ricota, 24 cm.
  ('ricota', 'Bizcocho', 'Manteca', 200, null),
  ('ricota', 'Bizcocho', 'Azúcar impalpable', 120, null),
  ('ricota', 'Bizcocho', 'Harina 0000', 400, null),
  ('ricota', 'Bizcocho', 'Polvo de hornear', 20, null),
  ('ricota', 'Bizcocho', 'Esencia de vainilla', 1, 'C/N en la fuente; 1 ml es un valor inicial editable.'),
  ('ricota', 'Bizcocho', 'Huevos', 2, 'Fuente: 110 g, equivalente a 2 huevos.'),
  ('ricota', 'Bizcocho', 'Sal fina', 5, null),
  ('ricota', 'Relleno', 'Ralladura de limón', 20, null),
  ('ricota', 'Relleno', 'Ricota', 450, null),
  ('ricota', 'Relleno', 'Queso crema', 150, null),
  ('ricota', 'Relleno', 'Azúcar', 120, null),
  ('ricota', 'Relleno', 'Claras de huevo', 140, null),
  ('ricota', 'Relleno', 'Esencia de vainilla', 20, null),

  -- Lemon Pie, 24 cm.
  ('lemon-pie', 'Bizcocho', 'Manteca', 150, null),
  ('lemon-pie', 'Bizcocho', 'Azúcar impalpable', 112, null),
  ('lemon-pie', 'Bizcocho', 'Harina 0000', 250, null),
  ('lemon-pie', 'Bizcocho', 'Yemas', 45, null),
  ('lemon-pie', 'Bizcocho', 'Ralladura de limón', 1, 'C/N en la fuente; 1 g es un valor inicial editable.'),
  ('lemon-pie', 'Relleno', 'Jugo de limón', 200, null),
  ('lemon-pie', 'Relleno', 'Ralladura de limón', 1, 'C/N en la fuente; 1 g es un valor inicial editable.'),
  ('lemon-pie', 'Relleno', 'Yemas', 72, null),
  ('lemon-pie', 'Relleno', 'Leche', 500, null),
  ('lemon-pie', 'Relleno', 'Almidón de maíz', 60, null),
  ('lemon-pie', 'Relleno', 'Manteca', 50, null),
  ('lemon-pie', 'Relleno', 'Azúcar', 200, null),
  ('lemon-pie', 'Cobertura', 'Claras de huevo', 250, null),
  ('lemon-pie', 'Cobertura', 'Azúcar', 500, null);

insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  r.id,
  rs.id,
  i.id,
  round(source_item.source_quantity * seeded.scale_factor, 3),
  source_item.quantity_note
from catalog_recipe_source_items source_item
join catalog_recipe_variants seeded on seeded.product_id = source_item.product_id
join public.recipes r on r.variant_id = seeded.variant_id
join public.recipe_sections rs
  on rs.recipe_id = r.id and rs.name = source_item.section_name
join public.ingredients i on i.name = source_item.ingredient_name
on conflict (recipe_id, section_id, ingredient_id) do nothing;

drop view if exists public.product_costs;
drop view if exists public.recipe_budget_summary;
drop view if exists public.recipe_items_admin;

create view public.recipe_items_admin
with (security_invoker = true)
as
select
  ri.id,
  r.id as recipe_id,
  r.name as recipe_name,
  r.variant_id,
  rs.id as section_id,
  rs.name as section_name,
  rs.sort_order as section_sort_order,
  i.id as ingredient_id,
  i.name as ingredient_name,
  i.base_unit,
  i.supply_type,
  i.size_label,
  ri.quantity,
  ri.quantity_note,
  cic.package_quantity,
  cic.package_price,
  cic.purchase_unit,
  cic.conversion_to_base,
  cic.recorded_at as price_recorded_at,
  cic.effective_unit_cost,
  case
    when cic.effective_unit_cost is null then null
    else round(ri.quantity * cic.effective_unit_cost, 2)
  end as line_cost
from public.recipe_items ri
join public.recipes r on r.id = ri.recipe_id
join public.recipe_sections rs on rs.id = ri.section_id
join public.ingredients i on i.id = ri.ingredient_id
left join public.current_ingredient_costs cic on cic.id = i.id;

grant select on public.recipe_items_admin to authenticated;

create view public.recipe_budget_summary
with (security_invoker = true)
as
with supply_totals as (
  select
    r.id as recipe_id,
    count(ri.id) as item_count,
    count(ri.id) filter (where cic.effective_unit_cost is not null) as priced_item_count,
    count(ri.id) filter (where cic.effective_unit_cost is null) as missing_price_count,
    coalesce(sum(ri.quantity * cic.effective_unit_cost), 0) as known_supply_cost
  from public.recipes r
  left join public.recipe_items ri on ri.recipe_id = r.id
  left join public.current_ingredient_costs cic on cic.id = ri.ingredient_id
  group by r.id
),
legacy_extra_totals as (
  select recipe_id, coalesce(sum(amount), 0) as extra_cost
  from public.recipe_extras
  group by recipe_id
),
calculated as (
  select
    r.id,
    r.variant_id,
    r.yield_quantity,
    r.target_margin_percent,
    r.rounding_increment,
    r.updated_at,
    r.name,
    r.customer_name,
    r.event_date,
    r.mold_size,
    r.presentation,
    r.quoted_price,
    r.status,
    r.notes,
    r.created_at,
    r.servings,
    st.item_count,
    st.priced_item_count,
    st.missing_price_count,
    round(st.known_supply_cost, 2) as known_supply_cost,
    case
      when st.missing_price_count = 0 then round(st.known_supply_cost, 2)
      else null
    end as supply_cost,
    coalesce(legacy.extra_cost, 0) as legacy_extra_cost
  from public.recipes r
  join supply_totals st on st.recipe_id = r.id
  left join legacy_extra_totals legacy on legacy.recipe_id = r.id
),
costed as (
  select
    c.*,
    case
      when c.supply_cost is null then null
      else round((c.supply_cost / c.yield_quantity) + c.legacy_extra_cost, 2)
    end as total_cost
  from calculated c
),
priced as (
  select
    c.*,
    case
      when c.item_count = 0 or c.total_cost is null then null
      else round(c.total_cost / (1 - c.target_margin_percent / 100), 2)
    end as unrounded_suggested_price
  from costed c
)
select
  p.*,
  case
    when p.unrounded_suggested_price is null then null
    else ceil(p.unrounded_suggested_price / p.rounding_increment)
      * p.rounding_increment
  end as suggested_price,
  case
    when p.quoted_price is null or p.total_cost is null then null
    else round(p.quoted_price - p.total_cost, 2)
  end as quoted_result,
  case
    when p.total_cost is null then null
    else round(p.total_cost / p.servings, 2)
  end as cost_per_serving,
  case
    when p.unrounded_suggested_price is null then null
    else round(
      (
        ceil(p.unrounded_suggested_price / p.rounding_increment)
          * p.rounding_increment
      ) / p.servings,
      2
    )
  end as suggested_price_per_serving
from priced p;

grant select on public.recipe_budget_summary to authenticated;

create view public.product_costs
with (security_invoker = true)
as
select
  v.id as variant_id,
  p.name as product_name,
  v.label as variant_label,
  v.published_price,
  rbs.id as recipe_id,
  rbs.yield_quantity,
  rbs.target_margin_percent,
  rbs.rounding_increment,
  rbs.item_count,
  rbs.priced_item_count,
  rbs.missing_price_count,
  rbs.known_supply_cost,
  rbs.supply_cost as ingredient_batch_cost,
  rbs.total_cost,
  rbs.unrounded_suggested_price,
  rbs.suggested_price,
  rbs.servings,
  rbs.cost_per_serving,
  rbs.suggested_price_per_serving,
  rbs.notes
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.recipe_budget_summary rbs on rbs.variant_id = v.id;

grant select on public.product_costs to authenticated;

create or replace function public.publish_suggested_price(target_variant_id text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_price numeric;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  select suggested_price
  into target_price
  from public.product_costs
  where variant_id = target_variant_id;

  if target_price is null then
    raise exception 'La receta no tiene un precio sugerido completo';
  end if;

  update public.product_variants
  set published_price = target_price
  where id = target_variant_id;

  return target_price;
end;
$$;

revoke all on function public.publish_suggested_price(text) from public;
grant execute on function public.publish_suggested_price(text) to authenticated;
