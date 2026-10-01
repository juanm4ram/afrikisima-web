-- Afrikísima: la merma depende del uso del ingrediente en cada receta.
-- La columna histórica de ingredients se migra y elimina;
-- los cálculos usan exclusivamente recipe_items.waste_percent.

alter table public.recipe_items
  add column if not exists waste_percent numeric(5, 2) not null default 0
    check (waste_percent >= 0 and waste_percent < 100);

-- Conserva el resultado de recetas ya cargadas antes de este cambio.
update public.recipe_items ri
set waste_percent = i.waste_percent
from public.ingredients i
where i.id = ri.ingredient_id
  and ri.waste_percent = 0
  and i.waste_percent <> 0;

create or replace view public.current_ingredient_costs
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.base_unit,
  0::numeric(5, 2) as waste_percent,
  latest.package_quantity,
  latest.package_price,
  latest.supplier,
  latest.recorded_at,
  case
    when previous.package_quantity is null or previous.package_price = 0 then null
    else round(
      (
        (latest.package_price / latest.package_quantity)
        / (previous.package_price / previous.package_quantity) - 1
      ) * 100,
      2
    )
  end as price_change_percent,
  case
    when latest.package_quantity is null then null
    else round(latest.package_price / latest.package_quantity, 4)
  end as effective_unit_cost,
  latest.brand
from public.ingredients i
left join lateral (
  select
    ip.package_quantity,
    ip.package_price,
    ip.supplier,
    ip.recorded_at,
    ip.brand
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  limit 1
) latest on true
left join lateral (
  select ip.package_quantity, ip.package_price
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  offset 1
  limit 1
) previous on true;

grant select on public.current_ingredient_costs to authenticated;

drop function if exists public.add_ingredient_with_price(
  text, text, numeric, numeric, numeric, text, text
);

create function public.add_ingredient_with_price(
  ingredient_name text,
  ingredient_unit text,
  initial_package_quantity numeric,
  initial_package_price numeric,
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
  if not public.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  insert into public.ingredients (name, base_unit)
  values (ingredient_name, ingredient_unit)
  returning id into new_id;

  insert into public.ingredient_prices (
    ingredient_id, package_quantity, package_price, supplier, brand, created_by
  )
  values (
    new_id, initial_package_quantity, initial_package_price,
    price_supplier, price_brand, auth.uid()
  );

  return new_id;
end;
$$;

revoke all on function public.add_ingredient_with_price(
  text, text, numeric, numeric, text, text
) from public;
grant execute on function public.add_ingredient_with_price(
  text, text, numeric, numeric, text, text
) to authenticated;

alter table public.ingredients drop column if exists waste_percent;

create or replace view public.recipe_items_admin
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
  round(
    ri.quantity / (1 - ri.waste_percent / 100) * cic.effective_unit_cost,
    2
  ) as line_cost,
  ri.waste_percent
from public.recipe_items ri
join public.recipes r on r.id = ri.recipe_id
join public.recipe_sections rs on rs.id = ri.section_id
join public.ingredients i on i.id = ri.ingredient_id
left join public.current_ingredient_costs cic on cic.id = i.id;

grant select on public.recipe_items_admin to authenticated;

create or replace view public.recipe_budget_summary
with (security_invoker = true)
as
with ingredient_totals as (
  select
    r.id as recipe_id,
    count(ri.id) as item_count,
    coalesce(sum(
      ri.quantity / (1 - ri.waste_percent / 100) * cic.effective_unit_cost
    ), 0) as ingredient_cost
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
    r.*,
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
  end as quoted_result
from calculated c;

grant select on public.recipe_budget_summary to authenticated;

drop function if exists public.set_recipe_item(text, uuid, numeric);

create function public.set_recipe_item(
  target_variant_id text,
  target_ingredient_id uuid,
  required_quantity numeric,
  item_waste_percent numeric default 0
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
  if not public.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  insert into public.recipes (variant_id)
  values (target_variant_id)
  on conflict (variant_id) do update set updated_at = now()
  returning id into target_recipe_id;

  insert into public.recipe_sections (recipe_id, name, sort_order)
  values (target_recipe_id, 'General', 0)
  on conflict (recipe_id, name) do update set name = excluded.name
  returning id into target_section_id;

  insert into public.recipe_items (
    recipe_id, section_id, ingredient_id, quantity, waste_percent
  )
  values (
    target_recipe_id, target_section_id, target_ingredient_id,
    required_quantity, item_waste_percent
  )
  on conflict (recipe_id, section_id, ingredient_id)
  do update set
    quantity = excluded.quantity,
    waste_percent = excluded.waste_percent
  returning id into target_item_id;

  return target_item_id;
end;
$$;

revoke all on function public.set_recipe_item(text, uuid, numeric, numeric)
  from public;
grant execute on function public.set_recipe_item(text, uuid, numeric, numeric)
  to authenticated;
