-- Afrikísima: catálogo, ingredientes, recetas y publicación de precios.
-- Ejecutar con Supabase CLI o pegar completo en el SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  category_id text not null references public.categories(id),
  name text not null,
  description text not null default '',
  image text not null,
  gallery text[],
  tags text[],
  sort_order integer not null default 0,
  is_published boolean not null default true
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  code text not null,
  label text not null,
  detail text not null default '',
  published_price numeric(12, 2) not null check (published_price >= 0),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  unique (product_id, code)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_unit text not null check (base_unit in ('g', 'ml', 'unit')),
  waste_percent numeric(5, 2) not null default 0
    check (waste_percent >= 0 and waste_percent < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  package_quantity numeric(12, 3) not null check (package_quantity > 0),
  package_price numeric(12, 2) not null check (package_price >= 0),
  supplier text,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists ingredient_prices_latest_idx
  on public.ingredient_prices (ingredient_id, recorded_at desc, created_at desc);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null unique references public.product_variants(id) on delete cascade,
  yield_quantity numeric(12, 3) not null default 1 check (yield_quantity > 0),
  labor_cost numeric(12, 2) not null default 0 check (labor_cost >= 0),
  packaging_cost numeric(12, 2) not null default 0 check (packaging_cost >= 0),
  overhead_percent numeric(6, 2) not null default 0 check (overhead_percent >= 0),
  target_margin_percent numeric(6, 2) not null default 30
    check (target_margin_percent >= 0 and target_margin_percent < 100),
  rounding_increment numeric(12, 2) not null default 500 check (rounding_increment > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unique (recipe_id, ingredient_id)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.app_admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_prices enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'products', 'product_variants', 'ingredients',
    'ingredient_prices', 'recipes', 'recipe_items'
  ]
  loop
    execute format('drop policy if exists admin_all on public.%I', table_name);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end
$$;

drop policy if exists admins_read_self on public.app_admins;
create policy admins_read_self
  on public.app_admins for select to authenticated
  using (user_id = auth.uid());

revoke all on public.app_admins, public.categories, public.products,
  public.product_variants, public.ingredients, public.ingredient_prices,
  public.recipes, public.recipe_items from anon;
grant select, insert, update, delete on public.categories, public.products,
  public.product_variants, public.ingredients, public.ingredient_prices,
  public.recipes, public.recipe_items to authenticated;
grant select on public.app_admins to authenticated;

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
  end as effective_unit_cost
from public.ingredients i
left join lateral (
  select ip.package_quantity, ip.package_price, ip.supplier, ip.recorded_at
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

create or replace view public.product_costs
with (security_invoker = true)
as
with recipe_totals as (
  select
    r.id as recipe_id,
    r.variant_id,
    r.yield_quantity,
    r.labor_cost,
    r.packaging_cost,
    r.overhead_percent,
    r.target_margin_percent,
    r.rounding_increment,
    count(ri.id) as item_count,
    coalesce(sum(ri.quantity * cic.effective_unit_cost), 0) as ingredient_batch_cost
  from public.recipes r
  left join public.recipe_items ri on ri.recipe_id = r.id
  left join public.current_ingredient_costs cic on cic.id = ri.ingredient_id
  group by r.id
),
calculated as (
  select
    rt.*,
    (rt.ingredient_batch_cost / rt.yield_quantity)
      + rt.labor_cost + rt.packaging_cost as direct_cost
  from recipe_totals rt
)
select
  v.id as variant_id,
  p.name as product_name,
  v.label as variant_label,
  v.published_price,
  c.recipe_id,
  c.yield_quantity,
  c.labor_cost,
  c.packaging_cost,
  c.overhead_percent,
  c.target_margin_percent,
  c.rounding_increment,
  c.item_count,
  round(c.ingredient_batch_cost, 2) as ingredient_batch_cost,
  round(c.direct_cost * (1 + c.overhead_percent / 100), 2) as total_cost,
  case
    when c.item_count = 0 then null
    else ceil(
      (
        c.direct_cost * (1 + c.overhead_percent / 100)
        / (1 - c.target_margin_percent / 100)
      ) / c.rounding_increment
    ) * c.rounding_increment
  end as suggested_price
from public.product_variants v
join public.products p on p.id = v.product_id
left join calculated c on c.variant_id = v.id;

grant select on public.product_costs to authenticated;

create or replace view public.recipe_items_admin
with (security_invoker = true)
as
select
  ri.id,
  r.variant_id,
  i.name as ingredient_name,
  i.base_unit,
  ri.quantity,
  round(ri.quantity * cic.effective_unit_cost, 2) as line_cost
from public.recipe_items ri
join public.recipes r on r.id = ri.recipe_id
join public.ingredients i on i.id = ri.ingredient_id
left join public.current_ingredient_costs cic on cic.id = i.id;

grant select on public.recipe_items_admin to authenticated;

create or replace function public.get_public_catalog()
returns table (
  category_id text,
  category_name text,
  category_sort integer,
  product_id text,
  product_slug text,
  product_name text,
  product_description text,
  product_image text,
  product_gallery text[],
  product_tags text[],
  product_sort integer,
  size_id text,
  size_label text,
  size_detail text,
  size_price numeric,
  size_sort integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.name, c.sort_order,
    p.id, p.slug, p.name, p.description, p.image, p.gallery, p.tags, p.sort_order,
    v.code, v.label, v.detail, v.published_price, v.sort_order
  from public.categories c
  join public.products p on p.category_id = c.id
  join public.product_variants v on v.product_id = p.id
  where p.is_published and v.is_published
  order by c.sort_order, p.sort_order, v.sort_order;
$$;

revoke all on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

create or replace function public.catalog_health()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where p.is_published and v.is_published;
$$;

revoke all on function public.catalog_health() from public;
grant execute on function public.catalog_health() to anon, authenticated;

create or replace function public.add_ingredient_with_price(
  ingredient_name text,
  ingredient_unit text,
  ingredient_waste_percent numeric,
  initial_package_quantity numeric,
  initial_package_price numeric,
  price_supplier text default null
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
    ingredient_id, package_quantity, package_price, supplier, created_by
  )
  values (
    new_id, initial_package_quantity, initial_package_price, price_supplier, auth.uid()
  );

  return new_id;
end;
$$;

create or replace function public.record_ingredient_price(
  target_ingredient_id uuid,
  new_package_quantity numeric,
  new_package_price numeric,
  price_supplier text default null
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
    ingredient_id, package_quantity, package_price, supplier, created_by
  )
  values (
    target_ingredient_id, new_package_quantity, new_package_price,
    price_supplier, auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.publish_suggested_prices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if not public.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  update public.product_variants v
  set published_price = pc.suggested_price
  from public.product_costs pc
  where pc.variant_id = v.id
    and pc.suggested_price is not null
    and pc.suggested_price <> v.published_price;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.upsert_recipe_settings(
  target_variant_id text,
  new_yield_quantity numeric,
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
  if not public.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  insert into public.recipes (
    variant_id, yield_quantity, labor_cost, packaging_cost,
    overhead_percent, target_margin_percent, rounding_increment, updated_at
  )
  values (
    target_variant_id, new_yield_quantity, new_labor_cost, new_packaging_cost,
    new_overhead_percent, new_target_margin_percent, new_rounding_increment, now()
  )
  on conflict (variant_id) do update set
    yield_quantity = excluded.yield_quantity,
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
  target_item_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  insert into public.recipes (variant_id)
  values (target_variant_id)
  on conflict (variant_id) do update set updated_at = now()
  returning id into target_recipe_id;

  insert into public.recipe_items (recipe_id, ingredient_id, quantity)
  values (target_recipe_id, target_ingredient_id, required_quantity)
  on conflict (recipe_id, ingredient_id) do update set quantity = excluded.quantity
  returning id into target_item_id;

  return target_item_id;
end;
$$;

revoke all on function public.add_ingredient_with_price(text, text, numeric, numeric, numeric, text) from public;
revoke all on function public.record_ingredient_price(uuid, numeric, numeric, text) from public;
revoke all on function public.publish_suggested_prices() from public;
revoke all on function public.upsert_recipe_settings(text, numeric, numeric, numeric, numeric, numeric, numeric) from public;
revoke all on function public.set_recipe_item(text, uuid, numeric) from public;
grant execute on function public.add_ingredient_with_price(text, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.record_ingredient_price(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.publish_suggested_prices() to authenticated;
grant execute on function public.upsert_recipe_settings(text, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.set_recipe_item(text, uuid, numeric) to authenticated;

insert into public.categories (id, name, sort_order) values
  ('personalizadas', 'Tortas Personalizadas', 10),
  ('clasicas', 'Tortas Clásicas', 20),
  ('tartas', 'Tartas', 30),
  ('cookies', 'Cookies', 40)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.products
  (id, slug, category_id, name, description, image, gallery, tags, sort_order)
values
  ('personalizada', 'torta-personalizada', 'personalizadas', 'Torta Personalizada',
   'Diseño a medida: temática, colores y mensaje. Nos escribís la idea y la cotizamos juntos.',
   '/products/personalizada.webp', null, array['A pedido'], 10),
  ('burn-away', 'burn-away-cake', 'personalizadas', 'Burn Away Cake',
   'Lleva una lámina de papel de arroz comestible sobre la cobertura: se quema la imagen de encima y debajo aparece la sorpresa escondida. Bizcochos y rellenos a elección.',
   '/products/burn-away.webp', array['/products/burn-away.webp','/products/burn-away-2.webp'], array['Novedad'], 20),
  ('glitter', 'glitter-cake', 'personalizadas', 'Glitter Cake',
   'Bizcochos y rellenos a elección. Ejemplo: bizcochos de vainilla con relleno de duraznos con crema.',
   '/products/glitter-cake.webp', array['/products/glitter-cake.webp','/products/glitter-cake-2.webp'], array['Personalizable'], 30),
  ('vintage', 'torta-vintage', 'personalizadas', 'Torta Vintage',
   'Bizcocho y rellenos a elección. Ejemplo: bizcocho de caramelo y relleno de ganache de caramelo.',
   '/products/vintage.webp', null, null, 40),
  ('fondant', 'torta-fondant', 'personalizadas', 'Torta Fondant',
   'Cobertura de fondant lisa, con apliques y figuras modeladas a mano según la temática. Bizcochos y rellenos a elección.',
   '/products/fondant.webp', null, null, 50),
  ('chaja', 'torta-chaja', 'clasicas', 'Torta Chajá',
   'Bizcochuelo húmedo, crema chantilly, duraznos en almíbar y merengue seco.',
   '/products/chaja.webp', array['/products/chaja.webp','/products/chaja-2.webp'], array['Más vendida'], 60),
  ('tiramisu', 'tiramisu', 'clasicas', 'Tiramisú',
   'Capas de bizcocho embebido en café, crema de mascarpone y cacao amargo espolvoreado.',
   '/products/tiramisu-3.webp', array['/products/tiramisu-3.webp','/products/tiramisu.webp','/products/tiramisu-2.webp'], null, 70),
  ('carrot-cake', 'carrot-cake', 'clasicas', 'Carrot Cake',
   'Bizcocho de zanahoria con frosting de queso crema.',
   '/products/carrot-cake.webp', null, null, 80),
  ('ricota', 'torta-de-ricota', 'clasicas', 'Torta de Ricota',
   'Clásica torta de ricota con limón.',
   '/products/ricota.webp', array['/products/ricota.webp','/products/ricota-2.webp'], null, 90),
  ('cheesecake-ny', 'cheesecake-new-york', 'tartas', 'Cheesecake New York',
   'Base de galleta con manteca, relleno cremoso de queso horneado y cobertura de frutos rojos.',
   '/products/cheesecake-ny.webp', null, null, 100),
  ('lemon-pie', 'lemon-pie', 'tartas', 'Lemon Pie',
   'Masa sablée, crema de limón bien cítrico y merengue italiano flameado a mano.',
   '/products/lemon-pie.webp', array['/products/lemon-pie.webp','/products/lemon-pie-2.webp'], null, 110),
  ('frutilla', 'tarta-de-frutilla', 'tartas', 'Tarta de Frutilla',
   'Masa dulce, crema pastelera de vainilla y frutillas frescas. Sujeta a temporada.',
   '/products/frutilla.webp', null, array['De temporada'], 120),
  ('cookies', 'cookies', 'cookies', 'Cookies con Chocolate',
   'Cookies de azúcar mascabo con chocolate semiamargo. Crocantes por fuera, tiernas adentro.',
   '/products/cookies.webp', null, array['Listas para llevar'], 130)
on conflict (id) do update set
  slug = excluded.slug, category_id = excluded.category_id, name = excluded.name,
  description = excluded.description, image = excluded.image, gallery = excluded.gallery,
  tags = excluded.tags, sort_order = excluded.sort_order;

insert into public.product_variants
  (id, product_id, code, label, detail, published_price, sort_order)
values
  ('personalizada-mediano', 'personalizada', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 45000, 10),
  ('personalizada-grande', 'personalizada', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 68000, 20),
  ('burn-away-mediano', 'burn-away', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 45000, 10),
  ('burn-away-grande', 'burn-away', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 68000, 20),
  ('glitter-mediano', 'glitter', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 42000, 10),
  ('glitter-grande', 'glitter', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 62000, 20),
  ('vintage-mediano', 'vintage', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 38000, 10),
  ('vintage-grande', 'vintage', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 58000, 20),
  ('fondant-mediano', 'fondant', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 45000, 10),
  ('fondant-grande', 'fondant', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 68000, 20),
  ('chaja-mediano', 'chaja', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 34000, 10),
  ('chaja-grande', 'chaja', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 52000, 20),
  ('tiramisu-mediano', 'tiramisu', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 33000, 10),
  ('tiramisu-grande', 'tiramisu', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 50000, 20),
  ('carrot-cake-mediano', 'carrot-cake', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 30000, 10),
  ('carrot-cake-grande', 'carrot-cake', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 46000, 20),
  ('ricota-mediano', 'ricota', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 28000, 10),
  ('ricota-grande', 'ricota', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 42000, 20),
  ('cheesecake-ny-mediano', 'cheesecake-ny', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 32000, 10),
  ('cheesecake-ny-grande', 'cheesecake-ny', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 48000, 20),
  ('lemon-pie-mediano', 'lemon-pie', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 29000, 10),
  ('lemon-pie-grande', 'lemon-pie', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 44000, 20),
  ('frutilla-mediano', 'frutilla', 'mediano', 'Mediana', '18 cm · 10 a 12 porciones', 35000, 10),
  ('frutilla-grande', 'frutilla', 'grande', 'Grande', '24 cm · 18 a 20 porciones', 54000, 20),
  ('cookies-mediano', 'cookies', 'mediano', 'Caja x6', '6 unidades', 12000, 10),
  ('cookies-grande', 'cookies', 'grande', 'Caja x12', '12 unidades', 22000, 20)
on conflict (id) do update set
  code = excluded.code, label = excluded.label, detail = excluded.detail,
  sort_order = excluded.sort_order;

-- Después de crear el usuario administrador en Authentication > Users:
-- insert into public.app_admins (user_id)
-- select id from auth.users where email = 'correo-de-la-duena@ejemplo.com';
