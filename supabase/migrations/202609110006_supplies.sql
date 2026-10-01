-- Afrikísima: unifica ingredientes y packaging como insumos.
-- También retira mano de obra, packaging fijo e indirectos del cálculo.

alter table public.ingredients
  add column if not exists supply_type text not null default 'ingredient'
    check (supply_type in ('ingredient', 'packaging')),
  add column if not exists size_label text;

insert into public.recipe_sections (recipe_id, name, sort_order)
select id, 'Packaging', 40
from public.recipes
on conflict (recipe_id, name) do nothing;

drop function if exists public.add_ingredient_with_price(text, text, numeric, numeric, text, numeric, text, text);
drop function if exists public.record_ingredient_price(uuid, numeric, numeric, text, numeric, text, text);
drop function if exists public.upsert_recipe_settings(text, numeric, integer, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.upsert_recipe_settings(text, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.add_supply_with_price(text, text, text, text, numeric, numeric, text, numeric, text, text);
drop function if exists public.upsert_recipe_settings(text, numeric, integer, numeric, numeric);

drop view if exists public.product_costs;
drop view if exists public.recipe_budget_summary;
drop view if exists public.recipe_items_admin;
drop view if exists public.current_ingredient_costs;

alter table public.recipes
  drop column if exists labor_cost,
  drop column if exists packaging_cost,
  drop column if exists overhead_percent;

create view public.current_ingredient_costs
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.base_unit,
  i.supply_type,
  i.size_label,
  latest.package_quantity,
  latest.package_price,
  latest.supplier,
  latest.recorded_at,
  case
    when previous.package_quantity is null or previous.package_price = 0 then null
    else round(
      (
        (latest.package_price / (latest.package_quantity * latest.conversion_to_base))
        / (previous.package_price / (previous.package_quantity * previous.conversion_to_base)) - 1
      ) * 100,
      2
    )
  end as price_change_percent,
  case
    when latest.package_quantity is null then null
    else round(
      latest.package_price / (latest.package_quantity * latest.conversion_to_base),
      4
    )
  end as effective_unit_cost,
  latest.brand,
  latest.purchase_unit,
  latest.conversion_to_base
from public.ingredients i
left join lateral (
  select
    ip.package_quantity,
    ip.package_price,
    ip.supplier,
    ip.recorded_at,
    ip.brand,
    ip.purchase_unit,
    ip.conversion_to_base
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  limit 1
) latest on true
left join lateral (
  select ip.package_quantity, ip.package_price, ip.conversion_to_base
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  offset 1
  limit 1
) previous on true;

grant select on public.current_ingredient_costs to authenticated;

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
  round(ri.quantity * cic.effective_unit_cost, 2) as line_cost
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
    coalesce(sum(ri.quantity * cic.effective_unit_cost), 0) as supply_cost
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
    st.supply_cost,
    coalesce(legacy.extra_cost, 0) as legacy_extra_cost,
    (st.supply_cost / r.yield_quantity) + coalesce(legacy.extra_cost, 0) as total_cost
  from public.recipes r
  join supply_totals st on st.recipe_id = r.id
  left join legacy_extra_totals legacy on legacy.recipe_id = r.id
)
select
  c.*,
  case
    when c.item_count = 0 then null
    else ceil(
      (c.total_cost / (1 - c.target_margin_percent / 100))
      / c.rounding_increment
    ) * c.rounding_increment
  end as suggested_price,
  case
    when c.quoted_price is null then null
    else round(c.quoted_price - c.total_cost, 2)
  end as quoted_result,
  round(c.total_cost / c.servings, 2) as cost_per_serving,
  case
    when c.item_count = 0 then null
    else round(
      (
        ceil(
          (c.total_cost / (1 - c.target_margin_percent / 100))
          / c.rounding_increment
        ) * c.rounding_increment
      ) / c.servings,
      2
    )
  end as suggested_price_per_serving
from calculated c;

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
  round(rbs.supply_cost, 2) as ingredient_batch_cost,
  rbs.total_cost,
  rbs.suggested_price,
  rbs.servings,
  rbs.cost_per_serving,
  rbs.suggested_price_per_serving
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.recipe_budget_summary rbs on rbs.variant_id = v.id;

grant select on public.product_costs to authenticated;

create function public.add_supply_with_price(
  supply_name text,
  new_supply_type text,
  supply_size_label text,
  supply_base_unit text,
  initial_package_quantity numeric,
  initial_package_price numeric,
  supply_purchase_unit text,
  supply_conversion_to_base numeric,
  price_supplier text default null,
  price_brand text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;
  if new_supply_type not in ('ingredient', 'packaging') then
    raise exception 'Tipo de insumo inválido';
  end if;

  if new_supply_type = 'packaging' then
    if nullif(trim(supply_size_label), '') is null then
      raise exception 'El packaging necesita un tamaño';
    end if;
    supply_base_unit := 'unit';
    initial_package_quantity := 1;
    supply_purchase_unit := 'unit';
    supply_conversion_to_base := 1;
    price_supplier := null;
    price_brand := null;
  end if;

  insert into public.ingredients (name, base_unit, supply_type, size_label)
  values (supply_name, supply_base_unit, new_supply_type, supply_size_label)
  returning id into new_id;

  insert into public.ingredient_prices (
    ingredient_id, package_quantity, package_price, purchase_unit,
    conversion_to_base, supplier, brand, created_by
  ) values (
    new_id, initial_package_quantity, initial_package_price,
    supply_purchase_unit, supply_conversion_to_base,
    price_supplier, price_brand, auth.uid()
  );

  return new_id;
end;
$$;

create function public.record_ingredient_price(
  target_ingredient_id uuid,
  new_package_quantity numeric,
  new_package_price numeric,
  new_purchase_unit text,
  new_conversion_to_base numeric,
  price_supplier text default null,
  price_brand text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  insert into public.ingredient_prices (
    ingredient_id, package_quantity, package_price, purchase_unit,
    conversion_to_base, supplier, brand, created_by
  ) values (
    target_ingredient_id, new_package_quantity, new_package_price,
    new_purchase_unit, new_conversion_to_base,
    price_supplier, price_brand, auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

create function public.upsert_recipe_settings(
  target_variant_id text,
  new_yield_quantity numeric,
  new_servings integer,
  new_target_margin_percent numeric,
  new_rounding_increment numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_recipe_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  insert into public.recipes (
    variant_id, yield_quantity, servings,
    target_margin_percent, rounding_increment, updated_at
  ) values (
    target_variant_id, new_yield_quantity, new_servings,
    new_target_margin_percent, new_rounding_increment, now()
  )
  on conflict (variant_id) do update set
    yield_quantity = excluded.yield_quantity,
    servings = excluded.servings,
    target_margin_percent = excluded.target_margin_percent,
    rounding_increment = excluded.rounding_increment,
    updated_at = now()
  returning id into target_recipe_id;

  return target_recipe_id;
end;
$$;

revoke all on function public.add_supply_with_price(
  text, text, text, text, numeric, numeric, text, numeric, text, text
) from public;
revoke all on function public.record_ingredient_price(
  uuid, numeric, numeric, text, numeric, text, text
) from public;
revoke all on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric
) from public;

grant execute on function public.add_supply_with_price(
  text, text, text, text, numeric, numeric, text, numeric, text, text
) to authenticated;
grant execute on function public.record_ingredient_price(
  uuid, numeric, numeric, text, numeric, text, text
) to authenticated;
grant execute on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric
) to authenticated;
