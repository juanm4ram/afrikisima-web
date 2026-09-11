-- Afrikísima: marca y proveedor separados en cada registro de compra.
-- Ejecutar después de 202609070002_custom_budgets.sql.

alter table public.ingredient_prices
  add column if not exists brand text;

create or replace view public.current_ingredient_costs
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.base_unit,
  i.waste_percent,
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
    else round(
      (latest.package_price / latest.package_quantity)
      / (1 - i.waste_percent / 100),
      4
    )
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
  text, text, numeric, numeric, numeric, text
);

create function public.add_ingredient_with_price(
  ingredient_name text,
  ingredient_unit text,
  ingredient_waste_percent numeric,
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

  insert into public.ingredients (name, base_unit, waste_percent)
  values (ingredient_name, ingredient_unit, ingredient_waste_percent)
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

drop function if exists public.record_ingredient_price(
  uuid, numeric, numeric, text
);

create function public.record_ingredient_price(
  target_ingredient_id uuid,
  new_package_quantity numeric,
  new_package_price numeric,
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

  insert into public.ingredient_prices (
    ingredient_id, package_quantity, package_price, supplier, brand, created_by
  )
  values (
    target_ingredient_id, new_package_quantity, new_package_price,
    price_supplier, price_brand, auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.add_ingredient_with_price(
  text, text, numeric, numeric, numeric, text, text
) from public;
revoke all on function public.record_ingredient_price(
  uuid, numeric, numeric, text, text
) from public;

grant execute on function public.add_ingredient_with_price(
  text, text, numeric, numeric, numeric, text, text
) to authenticated;
grant execute on function public.record_ingredient_price(
  uuid, numeric, numeric, text, text
) to authenticated;

