-- Afrikísima: presupuestos personalizados inspirados en la planilla histórica.
-- Ejecutar después de 202609070001_initial_pricing.sql.

alter table public.recipes alter column variant_id drop not null;

alter table public.recipes
  add column if not exists name text,
  add column if not exists customer_name text,
  add column if not exists event_date date,
  add column if not exists mold_size text,
  add column if not exists presentation text,
  add column if not exists quoted_price numeric(12, 2)
    check (quoted_price is null or quoted_price >= 0),
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'cancelled')),
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now();

update public.recipes r
set name = p.name || ' · ' || v.label
from public.product_variants v
join public.products p on p.id = v.product_id
where r.variant_id = v.id and r.name is null;

update public.recipes
set name = 'Presupuesto sin nombre'
where name is null;

alter table public.recipes alter column name set default 'Presupuesto sin nombre';
alter table public.recipes alter column name set not null;

create table if not exists public.recipe_sections (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (recipe_id, name)
);

alter table public.recipe_items
  add column if not exists section_id uuid references public.recipe_sections(id) on delete cascade,
  add column if not exists quantity_note text;

insert into public.recipe_sections (recipe_id, name, sort_order)
select id, 'General', 0
from public.recipes
on conflict (recipe_id, name) do nothing;

update public.recipe_items ri
set section_id = rs.id
from public.recipe_sections rs
where rs.recipe_id = ri.recipe_id
  and rs.name = 'General'
  and ri.section_id is null;

alter table public.recipe_items alter column section_id set not null;
alter table public.recipe_items
  drop constraint if exists recipe_items_recipe_id_ingredient_id_key;

create unique index if not exists recipe_items_section_ingredient_uidx
  on public.recipe_items (recipe_id, section_id, ingredient_id);

create table if not exists public.recipe_extras (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  kind text not null default 'presentation'
    check (kind in ('presentation', 'decoration', 'delivery', 'other')),
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recipe_sections enable row level security;
alter table public.recipe_extras enable row level security;

drop policy if exists admin_all on public.recipe_sections;
create policy admin_all on public.recipe_sections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.recipe_extras;
create policy admin_all on public.recipe_extras
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.recipe_sections, public.recipe_extras from anon;
grant select, insert, update, delete on public.recipe_sections, public.recipe_extras
  to authenticated;

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
  ri.quantity,
  ri.quantity_note,
  round(ri.quantity * cic.effective_unit_cost, 2) as line_cost
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

create or replace view public.product_costs
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
  rbs.suggested_price
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.recipe_budget_summary rbs on rbs.variant_id = v.id;

grant select on public.product_costs to authenticated;

create or replace function public.set_recipe_item(
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
    recipe_id, section_id, ingredient_id, quantity
  )
  values (
    target_recipe_id, target_section_id, target_ingredient_id, required_quantity
  )
  on conflict (recipe_id, section_id, ingredient_id)
  do update set quantity = excluded.quantity
  returning id into target_item_id;

  return target_item_id;
end;
$$;

revoke all on function public.set_recipe_item(text, uuid, numeric) from public;
grant execute on function public.set_recipe_item(text, uuid, numeric) to authenticated;
