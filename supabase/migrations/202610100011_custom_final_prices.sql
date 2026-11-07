-- Afrikísima: precio final personalizado y publicación elegida por el admin.
-- Ejecutar después de 202610100010_complete_published_recipe_costs.sql.

alter table public.recipes
  add column if not exists custom_profit_type text not null default 'percent'
    check (custom_profit_type in ('percent', 'amount')),
  add column if not exists custom_profit_value numeric(12, 2) not null default 0
    check (custom_profit_value >= 0);

alter table public.product_variants
  add column if not exists published_price_source text not null default 'manual'
    check (published_price_source in ('manual', 'suggested', 'custom')),
  add column if not exists published_price_updated_at timestamptz;

drop view if exists public.product_costs;
drop view if exists public.recipe_budget_summary;

create view public.recipe_budget_summary
with (security_invoker = true)
as
with supply_totals as (
  select
    recipe.id as recipe_id,
    count(recipe_item.id) as item_count,
    count(recipe_item.id) filter (where cost.effective_unit_cost is not null) as priced_item_count,
    count(recipe_item.id) filter (where cost.effective_unit_cost is null) as missing_price_count,
    coalesce(sum(recipe_item.quantity * cost.effective_unit_cost), 0) as known_supply_cost
  from public.recipes recipe
  left join public.recipe_items recipe_item on recipe_item.recipe_id = recipe.id
  left join public.current_ingredient_costs cost on cost.id = recipe_item.ingredient_id
  group by recipe.id
),
legacy_extra_totals as (
  select recipe_id, coalesce(sum(amount), 0) as extra_cost
  from public.recipe_extras
  group by recipe_id
),
calculated as (
  select
    recipe.id,
    recipe.variant_id,
    recipe.yield_quantity,
    recipe.target_margin_percent,
    recipe.rounding_increment,
    recipe.updated_at,
    recipe.name,
    recipe.customer_name,
    recipe.event_date,
    recipe.mold_size,
    recipe.presentation,
    recipe.quoted_price,
    recipe.status,
    recipe.notes,
    recipe.created_at,
    recipe.servings,
    recipe.custom_profit_type,
    recipe.custom_profit_value,
    supply.item_count,
    supply.priced_item_count,
    supply.missing_price_count,
    round(supply.known_supply_cost, 2) as known_supply_cost,
    case
      when supply.missing_price_count = 0 then round(supply.known_supply_cost, 2)
      else null
    end as supply_cost,
    coalesce(legacy.extra_cost, 0) as legacy_extra_cost
  from public.recipes recipe
  join supply_totals supply on supply.recipe_id = recipe.id
  left join legacy_extra_totals legacy on legacy.recipe_id = recipe.id
),
costed as (
  select
    calculated.*,
    case
      when calculated.supply_cost is null then null
      else round(
        (calculated.supply_cost / calculated.yield_quantity)
          + calculated.legacy_extra_cost,
        2
      )
    end as total_cost
  from calculated
),
priced as (
  select
    costed.*,
    case
      when costed.item_count = 0 or costed.total_cost is null then null
      else round(
        costed.total_cost / (1 - costed.target_margin_percent / 100),
        2
      )
    end as unrounded_suggested_price,
    case
      when costed.item_count = 0 or costed.total_cost is null then null
      when costed.custom_profit_type = 'percent' then
        round(costed.total_cost * costed.custom_profit_value / 100, 2)
      else round(costed.custom_profit_value, 2)
    end as custom_profit_amount
  from costed
)
select
  priced.*,
  case
    when priced.unrounded_suggested_price is null then null
    else ceil(priced.unrounded_suggested_price / priced.rounding_increment)
      * priced.rounding_increment
  end as suggested_price,
  case
    when priced.quoted_price is null or priced.total_cost is null then null
    else round(priced.quoted_price - priced.total_cost, 2)
  end as quoted_result,
  case
    when priced.total_cost is null then null
    else round(priced.total_cost / priced.servings, 2)
  end as cost_per_serving,
  case
    when priced.unrounded_suggested_price is null then null
    else round(
      (
        ceil(priced.unrounded_suggested_price / priced.rounding_increment)
          * priced.rounding_increment
      ) / priced.servings,
      2
    )
  end as suggested_price_per_serving,
  case
    when priced.custom_profit_amount is null then null
    else round(priced.total_cost + priced.custom_profit_amount, 2)
  end as custom_price,
  case
    when priced.custom_profit_amount is null then null
    else round(
      (priced.total_cost + priced.custom_profit_amount) / priced.servings,
      2
    )
  end as custom_price_per_serving
from priced;

grant select on public.recipe_budget_summary to authenticated;

comment on view public.recipe_budget_summary is
  'Calcula costo, sugerido por margen y precio personalizado como costo más ganancia porcentual o fija.';

create view public.product_costs
with (security_invoker = true)
as
select
  variant.id as variant_id,
  product.name as product_name,
  variant.label as variant_label,
  variant.published_price,
  variant.published_price_source,
  variant.published_price_updated_at,
  budget.id as recipe_id,
  budget.yield_quantity,
  budget.target_margin_percent,
  budget.rounding_increment,
  budget.custom_profit_type,
  budget.custom_profit_value,
  budget.item_count,
  budget.priced_item_count,
  budget.missing_price_count,
  budget.known_supply_cost,
  budget.supply_cost as ingredient_batch_cost,
  budget.total_cost,
  budget.unrounded_suggested_price,
  budget.suggested_price,
  budget.custom_profit_amount,
  budget.custom_price,
  budget.servings,
  budget.cost_per_serving,
  budget.suggested_price_per_serving,
  budget.custom_price_per_serving,
  budget.notes
from public.product_variants variant
join public.products product on product.id = variant.product_id
left join public.recipe_budget_summary budget on budget.variant_id = variant.id;

grant select on public.product_costs to authenticated;

drop function if exists public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric
);

create function public.upsert_recipe_settings(
  target_variant_id text,
  new_yield_quantity numeric,
  new_servings integer,
  new_target_margin_percent numeric,
  new_rounding_increment numeric,
  new_custom_profit_type text,
  new_custom_profit_value numeric
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
  if new_custom_profit_type not in ('percent', 'amount') then
    raise exception 'El tipo de ganancia debe ser percent o amount';
  end if;
  if new_custom_profit_value < 0 then
    raise exception 'La ganancia no puede ser negativa';
  end if;

  insert into public.recipes (
    variant_id, yield_quantity, servings,
    target_margin_percent, rounding_increment,
    custom_profit_type, custom_profit_value, updated_at
  ) values (
    target_variant_id, new_yield_quantity, new_servings,
    new_target_margin_percent, new_rounding_increment,
    new_custom_profit_type, new_custom_profit_value, now()
  )
  on conflict (variant_id) do update set
    yield_quantity = excluded.yield_quantity,
    servings = excluded.servings,
    target_margin_percent = excluded.target_margin_percent,
    rounding_increment = excluded.rounding_increment,
    custom_profit_type = excluded.custom_profit_type,
    custom_profit_value = excluded.custom_profit_value,
    updated_at = now()
  returning id into target_recipe_id;

  return target_recipe_id;
end;
$$;

revoke all on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric, text, numeric
) from public;
grant execute on function public.upsert_recipe_settings(
  text, numeric, integer, numeric, numeric, text, numeric
) to authenticated;

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
  set
    published_price = target_price,
    published_price_source = 'suggested',
    published_price_updated_at = now()
  where id = target_variant_id;

  return target_price;
end;
$$;

revoke all on function public.publish_suggested_price(text) from public;
grant execute on function public.publish_suggested_price(text) to authenticated;

create or replace function public.publish_custom_price(target_variant_id text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_price numeric;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  select custom_price
  into target_price
  from public.product_costs
  where variant_id = target_variant_id;

  if target_price is null then
    raise exception 'La receta no tiene un precio personalizado completo';
  end if;

  update public.product_variants
  set
    published_price = target_price,
    published_price_source = 'custom',
    published_price_updated_at = now()
  where id = target_variant_id;

  return target_price;
end;
$$;

revoke all on function public.publish_custom_price(text) from public;
grant execute on function public.publish_custom_price(text) to authenticated;

create or replace function public.publish_suggested_prices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not public.is_admin() then raise exception 'Acceso denegado'; end if;

  update public.product_variants variant
  set
    published_price = cost.suggested_price,
    published_price_source = 'suggested',
    published_price_updated_at = now()
  from public.product_costs cost
  where cost.variant_id = variant.id
    and cost.suggested_price is not null
    and cost.suggested_price <> variant.published_price;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.publish_suggested_prices() from public;
grant execute on function public.publish_suggested_prices() to authenticated;
