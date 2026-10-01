-- Afrikísima: porciones, unidades de compra y conversión automática.
-- Estado final: la merma deja de formar parte del modelo.

alter table public.recipes
  add column if not exists servings integer not null default 1
    check (servings > 0);

alter table public.ingredient_prices
  add column if not exists purchase_unit text,
  add column if not exists conversion_to_base numeric(12, 3) not null default 1
    check (conversion_to_base > 0);

update public.ingredient_prices ip
set purchase_unit = i.base_unit
from public.ingredients i
where i.id = ip.ingredient_id
  and ip.purchase_unit is null;

alter table public.ingredient_prices alter column purchase_unit set not null;

drop function if exists public.add_ingredient_with_price(text, text, numeric, numeric, numeric, text);
drop function if exists public.add_ingredient_with_price(text, text, numeric, numeric, numeric, text, text);
drop function if exists public.add_ingredient_with_price(text, text, numeric, numeric, text, text);

drop function if exists public.record_ingredient_price(uuid, numeric, numeric, text);
drop function if exists public.record_ingredient_price(uuid, numeric, numeric, text, text);

drop function if exists public.set_recipe_item(text, uuid, numeric);
drop function if exists public.set_recipe_item(text, uuid, numeric, numeric);

drop function if exists public.upsert_recipe_settings(text, numeric, numeric, numeric, numeric, numeric, numeric);

drop view if exists public.product_costs;
drop view if exists public.recipe_budget_summary;
drop view if exists public.recipe_items_admin;
drop view if exists public.current_ingredient_costs;

alter table public.recipe_items drop column if exists waste_percent;
alter table public.ingredients drop column if exists waste_percent;

create view public.current_ingredient_costs
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.base_unit,
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
  select
    ip.package_quantity,
    ip.package_price,
    ip.conversion_to_base
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
with ingredient_totals as (
  select
    r.id as recipe_id,
    count(ri.id) as item_count,
    coalesce(sum(ri.quantity * cic.effective_unit_cost), 0) as ingredient_cost
  from public.recipes r
  left join public.recipe_items ri on ri.recipe_id = r.id
  left join public.current_ingredient_costs cic on cic.id = ri.ingredient_id
  group by r.id
),
extra_totals as (
  select recipe_id, coalesce(sum(amount), 0) as extra_cost
  from public.recipe_extras
  group by recipe_id
),
calculated as (
  select
    r.id,
    r.variant_id,
    r.yield_quantity,
    r.labor_cost,
    r.packaging_cost,
    r.overhead_percent,
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
    it.item_count,
    it.ingredient_cost,
    coalesce(et.extra_cost, 0) as extra_cost,
    (it.ingredient_cost / r.yield_quantity)
      + r.labor_cost
      + r.packaging_cost
      + coalesce(et.extra_cost, 0) as direct_cost
  from public.recipes r
  join ingredient_totals it on it.recipe_id = r.id
  left join extra_totals et on et.recipe_id = r.id
)
select
  c.*,
  round(c.direct_cost * (1 + c.overhead_percent / 100), 2) as total_cost,
  case
    when c.item_count = 0 then null
    else ceil(
      (
        c.direct_cost * (1 + c.overhead_percent / 100)
        / (1 - c.target_margin_percent / 100)
      ) / c.rounding_increment
    ) * c.rounding_increment
  end as suggested_price,
  case
    when c.quoted_price is null then null
    else round(c.quoted_price - c.direct_cost * (1 + c.overhead_percent / 100), 2)
  end as quoted_result,
  round(c.direct_cost * (1 + c.overhead_percent / 100) / c.servings, 2)
    as cost_per_serving,
  case
    when c.item_count = 0 then null
    else round(
      (
        ceil(
          (
            c.direct_cost * (1 + c.overhead_percent / 100)
            / (1 - c.target_margin_percent / 100)
          ) / c.rounding_increment
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
  rbs.labor_cost,
  rbs.packaging_cost,
  rbs.overhead_percent,
  rbs.target_margin_percent,
  rbs.rounding_increment,
  rbs.item_count,
  round(rbs.ingredient_cost, 2) as ingredient_batch_cost,
  rbs.total_cost,
  rbs.suggested_price,
  rbs.servings,
  rbs.cost_per_serving,
  rbs.suggested_price_per_serving
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.recipe_budget_summary rbs on rbs.variant_id = v.id;

grant select on public.product_costs to authenticated;

create function public.add_ingredient_with_price(
  ingredient_name text,
  ingredient_unit text,
  initial_package_quantity numeric,
  initial_package_price numeric,
  ingredient_purchase_unit text,
  ingredient_conversion_to_base numeric,
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

  insert into public.ingredients (name, base_unit)
  values (ingredient_name, ingredient_unit)
  returning id into new_id;

  insert into public.ingredient_prices (
    ingredient_id, package_quantity, package_price, purchase_unit,
    conversion_to_base, supplier, brand, created_by
  ) values (
    new_id, initial_package_quantity, initial_package_price,
    ingredient_purchase_unit, ingredient_conversion_to_base,
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

create function public.set_recipe_item(
  target_variant_id text,
  target_ingredient_id uuid,
  required_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_recipe_id uuid;
  target_section_id uuid;
  target_item_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  insert into public.recipes (variant_id)
  values (target_variant_id)
  on conflict (variant_id) do update set updated_at = now()
  returning id into target_recipe_id;

  insert into public.recipe_sections (recipe_id, name, sort_order)
  values (target_recipe_id, 'General', 0)
  on conflict (recipe_id, name) do update set name = excluded.name
  returning id into target_section_id;

  insert into public.recipe_items (recipe_id, section_id, ingredient_id, quantity)
  values (target_recipe_id, target_section_id, target_ingredient_id, required_quantity)
  on conflict (recipe_id, section_id, ingredient_id)
  do update set quantity = excluded.quantity
  returning id into target_item_id;

  return target_item_id;
end;
$$;

create function public.upsert_recipe_settings(
  target_variant_id text,
  new_yield_quantity numeric,
  new_servings integer,
  new_labor_cost numeric,
  new_packaging_cost numeric,
  new_overhead_percent numeric,
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
    variant_id, yield_quantity, servings, labor_cost, packaging_cost,
    overhead_percent, target_margin_percent, rounding_increment, updated_at
  ) values (
    target_variant_id, new_yield_quantity, new_servings,
    new_labor_cost, new_packaging_cost, new_overhead_percent,
    new_target_margin_percent, new_rounding_increment, now()
  )
  on conflict (variant_id) do update set
    yield_quantity = excluded.yield_quantity,
    servings = excluded.servings,
    labor_cost = excluded.labor_cost,
    packaging_cost = excluded.packaging_cost,
    overhead_percent = excluded.overhead_percent,
    target_margin_percent = excluded.target_margin_percent,
    rounding_increment = excluded.rounding_increment,
    updated_at = now()
  returning id into target_recipe_id;

  return target_recipe_id;
end;
$$;

revoke all on function public.add_ingredient_with_price(
  text, text, numeric, numeric, text, numeric, text, text
) from public;
revoke all on function public.record_ingredient_price(
  uuid, numeric, numeric, text, numeric, text, text
) from public;
revoke all on function public.set_recipe_item(text, uuid, numeric) from public;
revoke all on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric, numeric, numeric, numeric
) from public;

grant execute on function public.add_ingredient_with_price(
  text, text, numeric, numeric, text, numeric, text, text
) to authenticated;
grant execute on function public.record_ingredient_price(
  uuid, numeric, numeric, text, numeric, text, text
) to authenticated;
grant execute on function public.set_recipe_item(text, uuid, numeric) to authenticated;
grant execute on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric, numeric, numeric, numeric
) to authenticated;
