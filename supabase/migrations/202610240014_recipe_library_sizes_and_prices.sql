-- Afrikísima: biblioteca de recetas, tamaños reales y precios del 2026-10-24.
-- Ejecutar después de 202610100013_lemon_unit_for_juice.sql.
--
-- Esta migración conserva las cantidades explícitas del relevamiento recibido.
-- Cuando una proporción escrita contradice los números detallados, prevalecen
-- los números y la discrepancia queda documentada en source_notes.

-- ---------------------------------------------------------------------------
-- Tamaños publicados
-- ---------------------------------------------------------------------------

update public.product_variants variant
set detail = case
  when variant.code = 'grande' then '24 cm · 18 a 20 porciones'
  when variant.product_id in ('tiramisu', 'ricota', 'cheesecake-ny', 'lemon-pie', 'frutilla')
    then '22 cm · 10 a 12 porciones'
  else '20 cm · 10 a 12 porciones'
end
where variant.product_id in (
  'personalizada', 'burn-away', 'glitter', 'vintage', 'fondant',
  'chaja', 'tiramisu', 'carrot-cake', 'ricota',
  'cheesecake-ny', 'lemon-pie', 'frutilla'
)
  and variant.code in ('mediano', 'grande');

-- Tartas y tiramisú mantienen exactamente la misma receta en 22 y 24 cm.
-- Primero elimina de la mediana los insumos que ya no existen en la grande.
delete from public.recipe_items
where id in (
  select medium_item.id
  from public.recipe_items medium_item
  join public.recipes medium_recipe on medium_item.recipe_id = medium_recipe.id
  join public.product_variants medium_variant on medium_recipe.variant_id = medium_variant.id
  join public.ingredients medium_supply on medium_item.ingredient_id = medium_supply.id
  join public.recipe_sections medium_section on medium_item.section_id = medium_section.id
  where medium_variant.code = 'mediano'
    and medium_variant.product_id in ('tiramisu', 'ricota', 'cheesecake-ny', 'lemon-pie', 'frutilla')
    and medium_supply.supply_type = 'ingredient'
    and not exists (
      select 1
      from public.product_variants large_variant
      join public.recipes large_recipe on large_recipe.variant_id = large_variant.id
      join public.recipe_sections large_section
        on large_section.recipe_id = large_recipe.id
        and large_section.name = medium_section.name
      join public.recipe_items large_item
        on large_item.recipe_id = large_recipe.id
        and large_item.section_id = large_section.id
        and large_item.ingredient_id = medium_item.ingredient_id
      where large_variant.product_id = medium_variant.product_id
        and large_variant.code = 'grande'
    )
);

insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  medium_recipe.id,
  medium_section.id,
  large_item.ingredient_id,
  large_item.quantity,
  concat_ws(
    ' ',
    nullif(large_item.quantity_note, ''),
    'Regla confirmada: la receta mediana de 22 cm usa la misma cantidad que la grande de 24 cm.'
  )
from public.product_variants large_variant
join public.recipes large_recipe on large_recipe.variant_id = large_variant.id
join public.recipe_sections large_section on large_section.recipe_id = large_recipe.id
join public.recipe_items large_item
  on large_item.recipe_id = large_recipe.id
  and large_item.section_id = large_section.id
join public.ingredients supply
  on supply.id = large_item.ingredient_id
  and supply.supply_type = 'ingredient'
join public.product_variants medium_variant
  on medium_variant.product_id = large_variant.product_id
  and medium_variant.code = 'mediano'
join public.recipes medium_recipe on medium_recipe.variant_id = medium_variant.id
join public.recipe_sections medium_section
  on medium_section.recipe_id = medium_recipe.id
  and medium_section.name = large_section.name
where large_variant.code = 'grande'
  and large_variant.product_id in ('tiramisu', 'ricota', 'cheesecake-ny', 'lemon-pie', 'frutilla')
on conflict (recipe_id, section_id, ingredient_id) do update set
  quantity = excluded.quantity,
  quantity_note = excluded.quantity_note;

update public.recipes recipe
set
  notes = concat_ws(
    ' ',
    nullif(recipe.notes, ''),
    'Actualización 2026-10-24: en 22 cm se conservan los mismos insumos y cantidades que en 24 cm.'
  ),
  updated_at = now()
from public.product_variants variant
where recipe.variant_id = variant.id
  and variant.code = 'mediano'
  and variant.product_id in ('tiramisu', 'ricota', 'cheesecake-ny', 'lemon-pie', 'frutilla')
  and coalesce(recipe.notes, '') not like '%Actualización 2026-10-24:%';

-- ---------------------------------------------------------------------------
-- Packaging por tamaño real
-- ---------------------------------------------------------------------------

with packaging_definitions as (
  select *
  from (values
    ('Caja para torta 30 cm', '30 cm', 'Caja para torta grande de 24 cm. Origen: Cotillón de Coronado.'),
    ('Tablita para torta 30 cm', '30 cm', 'Tablita para torta grande de 24 cm. Precio pendiente. Origen: Cotillón de Coronado.'),
    ('Caja para torta 25 cm', '25 cm', 'Caja para torta mediana de 20 cm o tiramisú mediano de 22 cm. Precio pendiente. Origen: Cotillón de Coronado.'),
    ('Tablita para torta 25 cm', '25 cm', 'Tablita para torta mediana de 20 cm o tiramisú mediano de 22 cm. Precio pendiente. Origen: Cotillón de Coronado.')
  ) as supplied_packaging(name, size_label, source_notes)
)
insert into public.ingredients (
  name, base_unit, supply_type, size_label, source_type, source_product_id,
  source_url, auto_update_enabled, source_notes
)
select
  name, 'unit', 'packaging', size_label, null, null, null, false, source_notes
from packaging_definitions
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
  size_label = excluded.size_label,
  source_type = null,
  source_product_id = null,
  source_url = null,
  auto_update_enabled = false,
  source_notes = excluded.source_notes,
  updated_at = now();

insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  supply.id, 1, 2700, 'Cotillón de Coronado', date '2026-10-24',
  null, 'unit', 1
from public.ingredients supply
where supply.name = 'Caja para torta 30 cm'
  and not exists (
    select 1
    from public.ingredient_prices existing
    where existing.ingredient_id = supply.id
      and existing.package_quantity = 1
      and existing.package_price = 2700
      and coalesce(existing.supplier, '') = 'Cotillón de Coronado'
      and existing.recorded_at = date '2026-10-24'
  );

-- Retira solo el par precargado por la migración anterior de las tortas.
delete from public.recipe_items
where id in (
  select recipe_item.id
  from public.recipe_items recipe_item
  join public.recipes recipe on recipe_item.recipe_id = recipe.id
  join public.product_variants variant on recipe.variant_id = variant.id
  join public.ingredients supply on recipe_item.ingredient_id = supply.id
  where variant.product_id in (
      'personalizada', 'burn-away', 'glitter', 'vintage', 'fondant',
      'chaja', 'tiramisu', 'carrot-cake'
    )
    and supply.name in ('Caja para torta 24 cm', 'Tablita para torta 22 cm')
);

with cake_products as (
  select *
  from (values
    ('personalizada'), ('burn-away'), ('glitter'), ('vintage'), ('fondant'),
    ('chaja'), ('tiramisu'), ('carrot-cake')
  ) as supplied_product(product_id)
), packaging_map as (
  select *
  from (values
    ('mediano', 'Caja para torta 25 cm'),
    ('mediano', 'Tablita para torta 25 cm'),
    ('grande', 'Caja para torta 30 cm'),
    ('grande', 'Tablita para torta 30 cm')
  ) as supplied_packaging(variant_code, supply_name)
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  1,
  case
    when variant.code = 'grande'
      then 'Torta de 24 cm: caja y tablita de 30 cm. Origen: Cotillón de Coronado.'
    else 'Torta mediana: caja y tablita de 25 cm. Origen: Cotillón de Coronado.'
  end
from cake_products product
join public.product_variants variant on variant.product_id = product.product_id
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_sections section
  on section.recipe_id = recipe.id
  and section.name = 'Packaging'
join packaging_map mapping on mapping.variant_code = variant.code
join public.ingredients supply on supply.name = mapping.supply_name
on conflict (recipe_id, section_id, ingredient_id) do update set
  quantity = excluded.quantity,
  quantity_note = excluded.quantity_note;

-- ---------------------------------------------------------------------------
-- Nuevos insumos y precios vigentes de referencia
-- ---------------------------------------------------------------------------

with supplied_ingredients as (
  select *
  from (values
    (
      'Crema de leche Milkaut 330 ml', 'ml', 'Milkaut 330 ml',
      'https://www.carrefour.com.ar/Lacteos-y-productos-frescos/Cremas-de-leche?dir=asc&order=price',
      false,
      'Pote Milkaut de 330 ml para chantilly grande y mediana. Precio de lista de Carrefour relevado el 2026-10-24; actualización manual hasta disponer de una ficha VTEX estable.'
    ),
    (
      'Crema de leche Milkaut 200 ml', 'ml', 'Milkaut 200 ml',
      'https://www.carrefour.com.ar/Lacteos-y-productos-frescos/Cremas-de-leche?dir=asc&order=price',
      false,
      'Pote chico Milkaut de 200 ml para chantilly de torta chica. Precio de lista de Carrefour relevado el 2026-10-24; actualización manual hasta disponer de una ficha VTEX estable.'
    ),
    (
      'Chocolate con leche', 'g', 'Nestlé suave y cremoso 80 g',
      'https://www.carrefour.com.ar/tableta-de-chocolate-con-leche-nestle-suave-y-cremoso-80-grs-778393/p',
      true,
      'Chocolate con leche Nestlé de 80 g. Se usa precio unitario de lista, no la promoción por dos unidades.'
    ),
    (
      'Galletitas Oreo', 'g', 'Oreo chocolate 118 g',
      'https://www.carrefour.com.ar/galletitas-oreo-rellenas-con-crema-de-chocolate-118-grs-747086/p',
      true,
      'Paquete Oreo de 118 g para chantilly con Oreo.'
    )
  ) as supplied(name, base_unit, size_label, source_url, auto_update_enabled, source_notes)
)
insert into public.ingredients (
  name, base_unit, supply_type, size_label, source_type, source_product_id,
  source_url, auto_update_enabled, source_notes
)
select
  supplied.name,
  supplied.base_unit,
  'ingredient',
  supplied.size_label,
  case when supplied.auto_update_enabled then 'carrefour_vtex' else null end,
  case supplied.name
    when 'Chocolate con leche' then '778393'
    when 'Galletitas Oreo' then '747086'
    else null
  end,
  supplied.source_url,
  supplied.auto_update_enabled,
  supplied.source_notes
from supplied_ingredients supplied
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
  size_label = excluded.size_label,
  source_type = excluded.source_type,
  source_product_id = excluded.source_product_id,
  source_url = excluded.source_url,
  auto_update_enabled = excluded.auto_update_enabled,
  source_notes = excluded.source_notes,
  updated_at = now();

with supplied_prices as (
  select *
  from (values
    ('Crema de leche Milkaut 330 ml', 330::numeric, 5750::numeric, 'Milkaut', 'ml'),
    ('Crema de leche Milkaut 200 ml', 200::numeric, 3639::numeric, 'Milkaut', 'ml'),
    ('Chocolate con leche', 80::numeric, 5900::numeric, 'Nestlé', 'g'),
    ('Galletitas Oreo', 118::numeric, 2469::numeric, 'Oreo', 'g')
  ) as supplied(name, package_quantity, package_price, brand, purchase_unit)
)
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  ingredient.id,
  price.package_quantity,
  price.package_price,
  'Carrefour Online',
  date '2026-10-24',
  price.brand,
  price.purchase_unit,
  1
from supplied_prices price
join public.ingredients ingredient on ingredient.name = price.name
where not exists (
  select 1
  from public.ingredient_prices existing
  where existing.ingredient_id = ingredient.id
    and existing.package_quantity = price.package_quantity
    and existing.package_price = price.package_price
    and coalesce(existing.supplier, '') = 'Carrefour Online'
    and coalesce(existing.brand, '') = price.brand
    and existing.recorded_at = date '2026-10-24'
);

-- ---------------------------------------------------------------------------
-- Biblioteca normalizada de recetas reutilizables
-- ---------------------------------------------------------------------------

create table if not exists public.recipe_templates (
  id text primary key,
  family text not null,
  component_type text not null
    check (component_type in ('sponge', 'filling', 'coverage')),
  name text not null,
  size_code text
    check (size_code is null or size_code in ('chica', 'mediana', 'grande')),
  diameter_cm numeric(8, 3)
    check (diameter_cm is null or diameter_cm > 0),
  floor_count integer
    check (floor_count is null or floor_count > 0),
  yield_quantity numeric(12, 3) not null default 1
    check (yield_quantity > 0),
  yield_unit text not null default 'preparación',
  is_complete boolean not null default true,
  source_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.recipe_templates(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  quantity numeric(12, 6) not null check (quantity > 0),
  quantity_note text,
  sort_order integer not null default 0,
  unique (template_id, ingredient_id)
);

create table if not exists public.recipe_scaling_rules (
  id text primary key,
  family text not null,
  component_name text not null,
  from_size text not null check (from_size in ('chica', 'mediana', 'grande')),
  to_size text not null check (to_size in ('chica', 'mediana', 'grande')),
  factor numeric(12, 6) check (factor is null or factor > 0),
  keeps_same_quantity boolean not null default false,
  notes text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_production_rules (
  id text primary key,
  family text not null,
  rule_name text not null,
  numeric_value numeric(12, 6),
  value_unit text,
  notes text not null,
  updated_at timestamptz not null default now()
);

alter table public.recipe_templates enable row level security;
alter table public.recipe_template_items enable row level security;
alter table public.recipe_scaling_rules enable row level security;
alter table public.recipe_production_rules enable row level security;

drop policy if exists admin_all on public.recipe_templates;
create policy admin_all on public.recipe_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.recipe_template_items;
create policy admin_all on public.recipe_template_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.recipe_scaling_rules;
create policy admin_all on public.recipe_scaling_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_all on public.recipe_production_rules;
create policy admin_all on public.recipe_production_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.recipe_templates, public.recipe_template_items,
  public.recipe_scaling_rules, public.recipe_production_rules from anon;
grant select, insert, update, delete on public.recipe_templates,
  public.recipe_template_items, public.recipe_scaling_rules,
  public.recipe_production_rules to authenticated;

-- Las filas incompletas conservan opciones nombradas sin inventar cantidades.
insert into public.recipe_templates (
  id, family, component_type, name, size_code, diameter_cm, floor_count,
  yield_quantity, yield_unit, is_complete, source_notes, sort_order
)
select *
from (values
  ('sponge-vanilla-1-large', 'torta', 'sponge', 'Bizcocho de vainilla', 'grande', 24, 1, 2, 'bizcochos', true, 'Cantidades explícitas del relevamiento.', 10),
  ('sponge-vanilla-1-medium', 'torta', 'sponge', 'Bizcocho de vainilla', 'mediana', 20, 1, 2, 'bizcochos', true, 'Cantidades explícitas del relevamiento.', 11),
  ('sponge-vanilla-1-small', 'torta', 'sponge', 'Bizcocho de vainilla', 'chica', null, 1, 2, 'bizcochos', true, 'Cantidades explícitas del relevamiento; diámetro no informado.', 12),
  ('sponge-chocolate-1-large', 'torta', 'sponge', 'Bizcocho de chocolate', 'grande', 24, 1, 2, 'bizcochos', true, 'Cantidades explícitas del relevamiento.', 20),
  ('sponge-chocolate-1-medium', 'torta', 'sponge', 'Bizcocho de chocolate', 'mediana', 20, 1, 2, 'bizcochos', true, 'Derivado exactamente como 2/3 de la grande.', 21),
  ('sponge-chocolate-1-small', 'torta', 'sponge', 'Bizcocho de chocolate', 'chica', null, 1, 2, 'bizcochos', true, 'Mitad de la grande; diámetro no informado.', 22),
  ('sponge-vanilla-2-large', 'torta', 'sponge', 'Bizcocho de vainilla', 'grande', 24, 2, 3, 'bizcochos', true, 'Cantidades explícitas del relevamiento.', 30),
  ('sponge-vanilla-2-medium', 'torta', 'sponge', 'Bizcocho de vainilla', 'mediana', 20, 2, 3, 'bizcochos', true, 'Se conservan los números explícitos. Azúcar, leche y aceite no coinciden con la anotación “2/3”.', 31),
  ('sponge-vanilla-2-small', 'torta', 'sponge', 'Bizcocho de vainilla', 'chica', null, 2, 3, 'bizcochos', true, 'Cantidades explícitas; diámetro no informado.', 32),
  ('sponge-chocolate-2-large', 'torta', 'sponge', 'Bizcocho de chocolate', 'grande', 24, 2, 3, 'bizcochos', true, 'Se conservan los números explícitos, aunque la nota “1/3 más” contradice que sean iguales a la receta grande de 1 piso.', 40),
  ('sponge-chocolate-2-medium', 'torta', 'sponge', 'Bizcocho de chocolate', 'mediana', 20, 2, 3, 'bizcochos', true, 'Derivado exactamente como 2/3 de los números explícitos de la grande.', 41),
  ('sponge-chocolate-2-small', 'torta', 'sponge', 'Bizcocho de chocolate', 'chica', null, 2, 3, 'bizcochos', true, 'Mitad de la grande; referencia Torta Valentino.', 42),
  ('sponge-marbled-pending', 'torta', 'sponge', 'Bizcocho marmoleado', null, null, null, 1, 'preparación', false, 'Opción mencionada sin ingredientes ni cantidades.', 50),
  ('sponge-caramelized-pending', 'torta', 'sponge', 'Bizcocho caramelizado', null, null, null, 1, 'preparación', false, 'Opción mencionada sin ingredientes ni cantidades.', 51),

  ('filling-dulce-large', 'torta', 'filling', 'Dulce de leche', 'grande', 24, null, 1, 'relleno', true, 'Cantidad explícita.', 100),
  ('filling-dulce-medium', 'torta', 'filling', 'Dulce de leche', 'mediana', 20, null, 1, 'relleno', true, 'Cantidad explícita: 1/4 menos que la grande.', 101),
  ('filling-dulce-small', 'torta', 'filling', 'Dulce de leche', 'chica', null, null, 1, 'relleno', true, 'Cantidad explícita: mitad de la grande.', 102),
  ('filling-chantilly-large', 'torta', 'filling', 'Crema chantilly Milkaut', 'grande', 24, null, 1, 'relleno', true, 'Un pote Milkaut de 330 ml.', 110),
  ('filling-chantilly-medium', 'torta', 'filling', 'Crema chantilly Milkaut', 'mediana', 20, null, 1, 'relleno', true, 'Tres cuartos de pote de 330 ml.', 111),
  ('filling-chantilly-small', 'torta', 'filling', 'Crema chantilly Milkaut', 'chica', null, null, 1, 'relleno', true, 'Un pote chico Milkaut de 200 ml.', 112),
  ('filling-white-ganache-large', 'torta', 'filling', 'Ganache de chocolate blanco 3:1', 'grande', 24, null, 1, 'relleno', true, 'Tres partes de chocolate por una de crema.', 120),
  ('filling-white-ganache-medium', 'torta', 'filling', 'Ganache de chocolate blanco 3:1', 'mediana', 20, null, 1, 'relleno', true, 'Cantidades explícitas.', 121),
  ('filling-white-ganache-small', 'torta', 'filling', 'Ganache de chocolate blanco 3:1', 'chica', null, null, 1, 'relleno', true, 'Cantidades explícitas.', 122),
  ('filling-milk-ganache-large', 'torta', 'filling', 'Ganache de chocolate con leche 2:1', 'grande', 24, null, 1, 'relleno', true, 'Dos partes de chocolate por una de crema.', 130),
  ('filling-milk-ganache-medium', 'torta', 'filling', 'Ganache de chocolate con leche 2:1', 'mediana', 20, null, 1, 'relleno', true, 'Cantidades explícitas.', 131),
  ('filling-milk-ganache-small', 'torta', 'filling', 'Ganache de chocolate con leche 2:1', 'chica', null, null, 1, 'relleno', true, 'Cantidades explícitas.', 132),
  ('filling-dark-ganache-large', 'torta', 'filling', 'Ganache de chocolate semi amargo 1,5:1', 'grande', 24, null, 1, 'relleno', true, 'Se usa Chocolate Águila 60% como semi amargo.', 140),
  ('filling-dark-ganache-medium', 'torta', 'filling', 'Ganache de chocolate semi amargo 1,5:1', 'mediana', 20, null, 1, 'relleno', true, 'Cantidades explícitas.', 141),
  ('filling-dark-ganache-small', 'torta', 'filling', 'Ganache de chocolate semi amargo 1,5:1', 'chica', null, null, 1, 'relleno', true, 'Cantidades explícitas.', 142),
  ('filling-strawberry-large', 'torta', 'filling', 'Chantilly con frutilla', 'grande', 24, null, 1, 'relleno', true, 'Incluye crema Milkaut y frutilla de Verdulería Tiziana.', 150),
  ('filling-strawberry-medium', 'torta', 'filling', 'Chantilly con frutilla', 'mediana', 20, null, 1, 'relleno', true, 'Incluye crema Milkaut y frutilla de Verdulería Tiziana.', 151),
  ('filling-strawberry-small', 'torta', 'filling', 'Chantilly con frutilla', 'chica', null, null, 1, 'relleno', true, 'Incluye pote chico Milkaut y frutilla de Verdulería Tiziana.', 152),
  ('filling-peach-large', 'torta', 'filling', 'Chantilly con duraznos', 'grande', 24, null, 1, 'relleno', true, 'Incluye crema Milkaut y una lata de 480 g (8 mitades).', 160),
  ('filling-peach-medium', 'torta', 'filling', 'Chantilly con duraznos', 'mediana', 20, null, 1, 'relleno', true, 'Cuatro mitades se registran como 240 g, media lata de referencia.', 161),
  ('filling-peach-small', 'torta', 'filling', 'Chantilly con duraznos', 'chica', null, null, 1, 'relleno', true, 'Cuatro mitades se registran como 240 g, media lata de referencia.', 162),
  ('filling-oreo-large', 'torta', 'filling', 'Chantilly con Oreo', 'grande', 24, null, 1, 'relleno', true, 'Un paquete y medio de 118 g.', 170),
  ('filling-oreo-medium', 'torta', 'filling', 'Chantilly con Oreo', 'mediana', 20, null, 1, 'relleno', true, 'Un paquete de 118 g.', 171),
  ('filling-oreo-small', 'torta', 'filling', 'Chantilly con Oreo', 'chica', null, null, 1, 'relleno', true, 'Medio paquete de 118 g.', 172),

  ('coverage-simple-small-1', 'torta', 'coverage', 'Buttercream simple', 'chica', null, 1, 1, 'cobertura', true, 'Proporción 1:2:2.', 200),
  ('coverage-simple-medium-1', 'torta', 'coverage', 'Buttercream simple', 'mediana', 20, 1, 1, 'cobertura', true, 'Misma cantidad que chica y grande.', 201),
  ('coverage-simple-large-1', 'torta', 'coverage', 'Buttercream simple', 'grande', 24, 1, 1, 'cobertura', true, 'Misma cantidad que chica y mediana.', 202),
  ('coverage-simple-small-2', 'torta', 'coverage', 'Buttercream simple', 'chica', null, 2, 1, 'cobertura', true, 'Doble de la cobertura de 1 piso.', 203),
  ('coverage-simple-medium-2', 'torta', 'coverage', 'Buttercream simple', 'mediana', 20, 2, 1, 'cobertura', true, 'Doble de la cobertura de 1 piso.', 204),
  ('coverage-simple-large-2', 'torta', 'coverage', 'Buttercream simple', 'grande', 24, 2, 1, 'cobertura', true, 'Doble de la cobertura de 1 piso.', 205),
  ('coverage-vintage-small-1', 'torta', 'coverage', 'Buttercream vintage', 'chica', null, 1, 1, 'cobertura', true, 'Cantidades explícitas; total declarado aproximado 2300 g.', 210),
  ('coverage-vintage-medium-1', 'torta', 'coverage', 'Buttercream vintage', 'mediana', 20, 1, 1, 'cobertura', true, 'Se conserva 930/1840/1840 aunque difiere de chica y grande de 1 piso.', 211),
  ('coverage-vintage-large-1', 'torta', 'coverage', 'Buttercream vintage', 'grande', 24, 1, 1, 'cobertura', true, 'Cantidades explícitas.', 212),
  ('coverage-vintage-small-2', 'torta', 'coverage', 'Buttercream vintage', 'chica', null, 2, 1, 'cobertura', true, 'Cantidades explícitas.', 213),
  ('coverage-vintage-medium-2', 'torta', 'coverage', 'Buttercream vintage', 'mediana', 20, 2, 1, 'cobertura', true, 'Cantidades explícitas.', 214),
  ('coverage-vintage-large-2', 'torta', 'coverage', 'Buttercream vintage', 'grande', 24, 2, 1, 'cobertura', true, 'Cantidades explícitas.', 215),
  ('coverage-simple-small-3', 'torta', 'coverage', 'Buttercream simple', 'chica', null, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 220),
  ('coverage-simple-medium-3', 'torta', 'coverage', 'Buttercream simple', 'mediana', 20, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 221),
  ('coverage-simple-large-3', 'torta', 'coverage', 'Buttercream simple', 'grande', 24, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 222),
  ('coverage-vintage-small-3', 'torta', 'coverage', 'Buttercream vintage', 'chica', null, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 223),
  ('coverage-vintage-medium-3', 'torta', 'coverage', 'Buttercream vintage', 'mediana', 20, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 224),
  ('coverage-vintage-large-3', 'torta', 'coverage', 'Buttercream vintage', 'grande', 24, 3, 1, 'cobertura', false, 'Se menciona 3 pisos, pero no se informaron cantidades.', 225)
) as template(
  id, family, component_type, name, size_code, diameter_cm, floor_count,
  yield_quantity, yield_unit, is_complete, source_notes, sort_order
)
on conflict (id) do update set
  family = excluded.family,
  component_type = excluded.component_type,
  name = excluded.name,
  size_code = excluded.size_code,
  diameter_cm = excluded.diameter_cm,
  floor_count = excluded.floor_count,
  yield_quantity = excluded.yield_quantity,
  yield_unit = excluded.yield_unit,
  is_complete = excluded.is_complete,
  source_notes = excluded.source_notes,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Reemplaza solamente los renglones de las plantillas administradas por esta
-- migración, para que una reejecución no duplique ni deje cantidades antiguas.
delete from public.recipe_template_items
where template_id like 'sponge-vanilla-%'
   or template_id like 'sponge-chocolate-%'
   or template_id in ('sponge-marbled-pending', 'sponge-caramelized-pending')
   or template_id like 'filling-dulce-%'
   or template_id like 'filling-chantilly-%'
   or template_id like 'filling-white-ganache-%'
   or template_id like 'filling-milk-ganache-%'
   or template_id like 'filling-dark-ganache-%'
   or template_id like 'filling-strawberry-%'
   or template_id like 'filling-peach-%'
   or template_id like 'filling-oreo-%'
   or template_id like 'coverage-simple-%'
   or template_id like 'coverage-vintage-%';

create temporary table supplied_template_items (
  template_id text not null,
  ingredient_name text not null,
  quantity numeric(12, 6) not null,
  quantity_note text,
  sort_order integer not null,
  primary key (template_id, ingredient_name)
) on commit drop;

insert into supplied_template_items values
  -- Bizcocho de vainilla, 1 piso.
  ('sponge-vanilla-1-large', 'Huevos', 6, null, 10),
  ('sponge-vanilla-1-large', 'Azúcar', 360, null, 20),
  ('sponge-vanilla-1-large', 'Leche', 330, null, 30),
  ('sponge-vanilla-1-large', 'Aceite', 320, null, 40),
  ('sponge-vanilla-1-large', 'Harina 0000', 500, null, 50),
  ('sponge-vanilla-1-large', 'Esencia de vainilla', 30, null, 60),
  ('sponge-vanilla-1-medium', 'Huevos', 4, null, 10),
  ('sponge-vanilla-1-medium', 'Azúcar', 240, null, 20),
  ('sponge-vanilla-1-medium', 'Leche', 220, null, 30),
  ('sponge-vanilla-1-medium', 'Aceite', 210, 'Cantidad explícita; no se redondea a 213,333 ml.', 40),
  ('sponge-vanilla-1-medium', 'Harina 0000', 333, null, 50),
  ('sponge-vanilla-1-medium', 'Esencia de vainilla', 20, null, 60),
  ('sponge-vanilla-1-small', 'Huevos', 3, null, 10),
  ('sponge-vanilla-1-small', 'Azúcar', 180, null, 20),
  ('sponge-vanilla-1-small', 'Leche', 165, null, 30),
  ('sponge-vanilla-1-small', 'Aceite', 155, 'Cantidad explícita; no se sustituye por 160 ml.', 40),
  ('sponge-vanilla-1-small', 'Harina 0000', 250, null, 50),
  ('sponge-vanilla-1-small', 'Esencia de vainilla', 15, null, 60),

  -- Bizcocho de chocolate, 1 piso. Huevos: 55 g por unidad.
  ('sponge-chocolate-1-large', 'Huevos', 4, '220 g equivalen a 4 huevos de 55 g.', 10),
  ('sponge-chocolate-1-large', 'Azúcar', 300, null, 20),
  ('sponge-chocolate-1-large', 'Leche', 500, 'La fuente expresa 500 g; se registra 500 ml.', 30),
  ('sponge-chocolate-1-large', 'Aceite', 250, null, 40),
  ('sponge-chocolate-1-large', 'Harina 0000', 520, null, 50),
  ('sponge-chocolate-1-large', 'Cacao amargo', 120, null, 60),
  ('sponge-chocolate-1-large', 'Bicarbonato de sodio', 5, null, 70),
  ('sponge-chocolate-1-large', 'Polvo de hornear', 10, null, 80),
  ('sponge-chocolate-1-medium', 'Huevos', 2.666667, '146,667 g: 2/3 de 220 g, convertido a huevos de 55 g.', 10),
  ('sponge-chocolate-1-medium', 'Azúcar', 200, null, 20),
  ('sponge-chocolate-1-medium', 'Leche', 333.333333, '2/3 de 500 g; se registra en ml.', 30),
  ('sponge-chocolate-1-medium', 'Aceite', 166.666667, null, 40),
  ('sponge-chocolate-1-medium', 'Harina 0000', 346.666667, null, 50),
  ('sponge-chocolate-1-medium', 'Cacao amargo', 80, null, 60),
  ('sponge-chocolate-1-medium', 'Bicarbonato de sodio', 3.333333, null, 70),
  ('sponge-chocolate-1-medium', 'Polvo de hornear', 6.666667, null, 80),
  ('sponge-chocolate-1-small', 'Huevos', 2, '110 g equivalen a 2 huevos de 55 g.', 10),
  ('sponge-chocolate-1-small', 'Azúcar', 150, null, 20),
  ('sponge-chocolate-1-small', 'Leche', 250, 'La fuente expresa 250 g; se registra en ml.', 30),
  ('sponge-chocolate-1-small', 'Aceite', 125, null, 40),
  ('sponge-chocolate-1-small', 'Harina 0000', 260, null, 50),
  ('sponge-chocolate-1-small', 'Cacao amargo', 60, null, 60),
  ('sponge-chocolate-1-small', 'Bicarbonato de sodio', 2.5, null, 70),
  ('sponge-chocolate-1-small', 'Polvo de hornear', 5, null, 80),

  -- Bizcocho de vainilla, 2 pisos.
  ('sponge-vanilla-2-large', 'Huevos', 12, null, 10),
  ('sponge-vanilla-2-large', 'Azúcar', 720, null, 20),
  ('sponge-vanilla-2-large', 'Leche', 660, null, 30),
  ('sponge-vanilla-2-large', 'Aceite', 660, null, 40),
  ('sponge-vanilla-2-large', 'Harina 0000', 1000, null, 50),
  ('sponge-vanilla-2-large', 'Esencia de vainilla', 60, null, 60),
  ('sponge-vanilla-2-large', 'Polvo de hornear', 10, null, 70),
  ('sponge-vanilla-2-medium', 'Huevos', 8, 'Coincide con 2/3.', 10),
  ('sponge-vanilla-2-medium', 'Azúcar', 160, 'Valor explícito; no coincide con 2/3 de 720 g.', 20),
  ('sponge-vanilla-2-medium', 'Leche', 146, 'Valor explícito; no coincide con 2/3 de 660 ml.', 30),
  ('sponge-vanilla-2-medium', 'Aceite', 146, 'Valor explícito; no coincide con 2/3 de 660 ml.', 40),
  ('sponge-vanilla-2-medium', 'Harina 0000', 666, null, 50),
  ('sponge-vanilla-2-medium', 'Esencia de vainilla', 40, null, 60),
  ('sponge-vanilla-2-medium', 'Polvo de hornear', 6.6, null, 70),
  ('sponge-vanilla-2-small', 'Huevos', 6, 'La fuente también indica 330 g.', 10),
  ('sponge-vanilla-2-small', 'Azúcar', 360, null, 20),
  ('sponge-vanilla-2-small', 'Leche', 330, null, 30),
  ('sponge-vanilla-2-small', 'Aceite', 320, 'Valor explícito.', 40),
  ('sponge-vanilla-2-small', 'Harina 0000', 500, null, 50),
  ('sponge-vanilla-2-small', 'Esencia de vainilla', 30, null, 60),
  ('sponge-vanilla-2-small', 'Polvo de hornear', 5, null, 70),

  -- Bizcocho de chocolate, 2 pisos.
  ('sponge-chocolate-2-large', 'Huevos', 4, '220 g equivalen a 4 huevos. Se conserva el valor explícito.', 10),
  ('sponge-chocolate-2-large', 'Azúcar', 300, 'Se conserva el valor explícito aunque la nota dice “1/3 más”.', 20),
  ('sponge-chocolate-2-large', 'Leche', 500, 'La fuente expresa 500 g; se registra en ml.', 30),
  ('sponge-chocolate-2-large', 'Aceite', 250, null, 40),
  ('sponge-chocolate-2-large', 'Harina 0000', 520, null, 50),
  ('sponge-chocolate-2-large', 'Cacao amargo', 120, null, 60),
  ('sponge-chocolate-2-large', 'Bicarbonato de sodio', 5, null, 70),
  ('sponge-chocolate-2-large', 'Polvo de hornear', 10, null, 80),
  ('sponge-chocolate-2-large', 'Esencia de vainilla', 30, null, 90),
  ('sponge-chocolate-2-medium', 'Huevos', 2.666667, '146,667 g; 2/3 de la cantidad explícita grande.', 10),
  ('sponge-chocolate-2-medium', 'Azúcar', 200, null, 20),
  ('sponge-chocolate-2-medium', 'Leche', 333.333333, '2/3 de 500 g; se registra en ml.', 30),
  ('sponge-chocolate-2-medium', 'Aceite', 166.666667, null, 40),
  ('sponge-chocolate-2-medium', 'Harina 0000', 346.666667, null, 50),
  ('sponge-chocolate-2-medium', 'Cacao amargo', 80, null, 60),
  ('sponge-chocolate-2-medium', 'Bicarbonato de sodio', 3.333333, null, 70),
  ('sponge-chocolate-2-medium', 'Polvo de hornear', 6.666667, null, 80),
  ('sponge-chocolate-2-medium', 'Esencia de vainilla', 20, null, 90),
  ('sponge-chocolate-2-small', 'Huevos', 2, '110 g equivalen a 2 huevos.', 10),
  ('sponge-chocolate-2-small', 'Azúcar', 150, null, 20),
  ('sponge-chocolate-2-small', 'Leche', 250, 'La fuente expresa 250 g; se registra en ml.', 30),
  ('sponge-chocolate-2-small', 'Aceite', 125, null, 40),
  ('sponge-chocolate-2-small', 'Harina 0000', 260, null, 50),
  ('sponge-chocolate-2-small', 'Cacao amargo', 60, null, 60),
  ('sponge-chocolate-2-small', 'Bicarbonato de sodio', 2.5, null, 70),
  ('sponge-chocolate-2-small', 'Polvo de hornear', 5, null, 80),
  ('sponge-chocolate-2-small', 'Esencia de vainilla', 15, null, 90),

  -- Rellenos.
  ('filling-dulce-large', 'Dulce de leche repostero', 400, 'Dos potes según la fuente.', 10),
  ('filling-dulce-medium', 'Dulce de leche repostero', 300, 'Un pote y medio según la fuente.', 10),
  ('filling-dulce-small', 'Dulce de leche repostero', 200, 'Un pote según la fuente.', 10),
  ('filling-chantilly-large', 'Crema de leche Milkaut 330 ml', 330, 'Un pote completo.', 10),
  ('filling-chantilly-medium', 'Crema de leche Milkaut 330 ml', 247.5, 'Tres cuartos de pote.', 10),
  ('filling-chantilly-small', 'Crema de leche Milkaut 200 ml', 200, 'Un pote chico completo.', 10),
  ('filling-white-ganache-large', 'Chocolate blanco', 600, null, 10),
  ('filling-white-ganache-large', 'Crema para batir', 200, null, 20),
  ('filling-white-ganache-medium', 'Chocolate blanco', 375, null, 10),
  ('filling-white-ganache-medium', 'Crema para batir', 125, null, 20),
  ('filling-white-ganache-small', 'Chocolate blanco', 225, null, 10),
  ('filling-white-ganache-small', 'Crema para batir', 75, null, 20),
  ('filling-milk-ganache-large', 'Chocolate con leche', 600, null, 10),
  ('filling-milk-ganache-large', 'Crema para batir', 300, null, 20),
  ('filling-milk-ganache-medium', 'Chocolate con leche', 300, null, 10),
  ('filling-milk-ganache-medium', 'Crema para batir', 150, null, 20),
  ('filling-milk-ganache-small', 'Chocolate con leche', 200, null, 10),
  ('filling-milk-ganache-small', 'Crema para batir', 100, null, 20),
  ('filling-dark-ganache-large', 'Chocolate Aguila', 525, 'Chocolate semi amargo Águila 60%.', 10),
  ('filling-dark-ganache-large', 'Crema para batir', 350, null, 20),
  ('filling-dark-ganache-medium', 'Chocolate Aguila', 300, 'Chocolate semi amargo Águila 60%.', 10),
  ('filling-dark-ganache-medium', 'Crema para batir', 200, null, 20),
  ('filling-dark-ganache-small', 'Chocolate Aguila', 225, 'Chocolate semi amargo Águila 60%.', 10),
  ('filling-dark-ganache-small', 'Crema para batir', 150, null, 20),
  ('filling-strawberry-large', 'Crema de leche Milkaut 330 ml', 330, 'Base de chantilly.', 10),
  ('filling-strawberry-large', 'Frutillas', 200, 'Origen: Verdulería Tiziana.', 20),
  ('filling-strawberry-medium', 'Crema de leche Milkaut 330 ml', 247.5, 'Base de chantilly.', 10),
  ('filling-strawberry-medium', 'Frutillas', 100, 'Origen: Verdulería Tiziana.', 20),
  ('filling-strawberry-small', 'Crema de leche Milkaut 200 ml', 200, 'Base de chantilly; pote chico.', 10),
  ('filling-strawberry-small', 'Frutillas', 50, 'Origen: Verdulería Tiziana.', 20),
  ('filling-peach-large', 'Crema de leche Milkaut 330 ml', 330, 'Base de chantilly.', 10),
  ('filling-peach-large', 'Duraznos en almíbar', 480, 'Una lata, 8 mitades.', 20),
  ('filling-peach-medium', 'Crema de leche Milkaut 330 ml', 247.5, 'Base de chantilly.', 10),
  ('filling-peach-medium', 'Duraznos en almíbar', 240, 'Cuatro mitades; equivalencia derivada como media lata de 480 g.', 20),
  ('filling-peach-small', 'Crema de leche Milkaut 200 ml', 200, 'Base de chantilly; pote chico.', 10),
  ('filling-peach-small', 'Duraznos en almíbar', 240, 'Cuatro mitades; equivalencia derivada como media lata de 480 g.', 20),
  ('filling-oreo-large', 'Crema de leche Milkaut 330 ml', 330, 'Base de chantilly.', 10),
  ('filling-oreo-large', 'Galletitas Oreo', 177, 'Un paquete y medio de 118 g.', 20),
  ('filling-oreo-medium', 'Crema de leche Milkaut 330 ml', 247.5, 'Base de chantilly.', 10),
  ('filling-oreo-medium', 'Galletitas Oreo', 118, 'Un paquete de 118 g.', 20),
  ('filling-oreo-small', 'Crema de leche Milkaut 200 ml', 200, 'Base de chantilly; pote chico.', 10),
  ('filling-oreo-small', 'Galletitas Oreo', 59, 'Medio paquete de 118 g.', 20),

  -- Coberturas simples.
  ('coverage-simple-small-1', 'Claras de huevo', 300, 'Proporción 1:2:2.', 10),
  ('coverage-simple-small-1', 'Azúcar', 600, null, 20),
  ('coverage-simple-small-1', 'Manteca', 600, null, 30),
  ('coverage-simple-medium-1', 'Claras de huevo', 300, 'Proporción 1:2:2.', 10),
  ('coverage-simple-medium-1', 'Azúcar', 600, null, 20),
  ('coverage-simple-medium-1', 'Manteca', 600, null, 30),
  ('coverage-simple-large-1', 'Claras de huevo', 300, 'Proporción 1:2:2.', 10),
  ('coverage-simple-large-1', 'Azúcar', 600, null, 20),
  ('coverage-simple-large-1', 'Manteca', 600, null, 30),
  ('coverage-simple-small-2', 'Claras de huevo', 600, 'Proporción 1:2:2.', 10),
  ('coverage-simple-small-2', 'Azúcar', 1200, null, 20),
  ('coverage-simple-small-2', 'Manteca', 1200, null, 30),
  ('coverage-simple-medium-2', 'Claras de huevo', 600, 'Proporción 1:2:2.', 10),
  ('coverage-simple-medium-2', 'Azúcar', 1200, null, 20),
  ('coverage-simple-medium-2', 'Manteca', 1200, null, 30),
  ('coverage-simple-large-2', 'Claras de huevo', 600, 'Proporción 1:2:2.', 10),
  ('coverage-simple-large-2', 'Azúcar', 1200, null, 20),
  ('coverage-simple-large-2', 'Manteca', 1200, null, 30),

  -- Coberturas vintage; se preservan los números explícitos por tamaño/piso.
  ('coverage-vintage-small-1', 'Claras de huevo', 465, null, 10),
  ('coverage-vintage-small-1', 'Azúcar', 920, null, 20),
  ('coverage-vintage-small-1', 'Manteca', 920, null, 30),
  ('coverage-vintage-medium-1', 'Claras de huevo', 930, 'Valor explícito; difiere de chica y grande de 1 piso.', 10),
  ('coverage-vintage-medium-1', 'Azúcar', 1840, 'Valor explícito.', 20),
  ('coverage-vintage-medium-1', 'Manteca', 1840, 'Valor explícito.', 30),
  ('coverage-vintage-large-1', 'Claras de huevo', 465, null, 10),
  ('coverage-vintage-large-1', 'Azúcar', 920, null, 20),
  ('coverage-vintage-large-1', 'Manteca', 920, null, 30),
  ('coverage-vintage-small-2', 'Claras de huevo', 930, null, 10),
  ('coverage-vintage-small-2', 'Azúcar', 1840, null, 20),
  ('coverage-vintage-small-2', 'Manteca', 1840, null, 30),
  ('coverage-vintage-medium-2', 'Claras de huevo', 930, null, 10),
  ('coverage-vintage-medium-2', 'Azúcar', 1840, null, 20),
  ('coverage-vintage-medium-2', 'Manteca', 1840, null, 30),
  ('coverage-vintage-large-2', 'Claras de huevo', 930, null, 10),
  ('coverage-vintage-large-2', 'Azúcar', 1840, null, 20),
  ('coverage-vintage-large-2', 'Manteca', 1840, null, 30);

insert into public.recipe_template_items (
  template_id, ingredient_id, quantity, quantity_note, sort_order
)
select
  supplied.template_id,
  ingredient.id,
  supplied.quantity,
  supplied.quantity_note,
  supplied.sort_order
from supplied_template_items supplied
join public.ingredients ingredient on ingredient.name = supplied.ingredient_name
on conflict (template_id, ingredient_id) do update set
  quantity = excluded.quantity,
  quantity_note = excluded.quantity_note,
  sort_order = excluded.sort_order;

insert into public.recipe_scaling_rules (
  id, family, component_name, from_size, to_size, factor,
  keeps_same_quantity, notes
)
select *
from (values
  ('tarts-large-medium', 'tarta', 'Receta completa', 'grande', 'mediana', 1::numeric, true, 'De 24 cm a 22 cm no cambia ningún ingrediente ni cantidad.'),
  ('tiramisu-large-medium', 'tiramisu', 'Receta completa', 'grande', 'mediana', 1::numeric, true, 'De 24 cm a 22 cm no cambia ningún ingrediente ni cantidad.'),
  ('tiramisu-large-small', 'tiramisu', 'Receta completa', 'grande', 'chica', 0.5::numeric, false, 'La chica usa la mitad de la grande.'),
  ('tiramisu-medium-small', 'tiramisu', 'Receta completa', 'mediana', 'chica', 0.666667::numeric, false, 'La chica usa 1/3 menos que la mediana. Esta regla entra en conflicto matemático con las dos reglas anteriores y requiere confirmar cuál prevalece.'),
  ('cake-sponge-large-medium', 'torta', 'Bizcocho', 'grande', 'mediana', 0.666667::numeric, false, 'Regla general 2/3; las cantidades explícitas de cada plantilla prevalecen.'),
  ('cake-sponge-large-small', 'torta', 'Bizcocho', 'grande', 'chica', 0.5::numeric, false, 'Regla general de mitad; las cantidades explícitas de cada plantilla prevalecen.')
) as rule(id, family, component_name, from_size, to_size, factor, keeps_same_quantity, notes)
on conflict (id) do update set
  family = excluded.family,
  component_name = excluded.component_name,
  from_size = excluded.from_size,
  to_size = excluded.to_size,
  factor = excluded.factor,
  keeps_same_quantity = excluded.keeps_same_quantity,
  notes = excluded.notes,
  updated_at = now();

insert into public.recipe_production_rules (
  id, family, rule_name, numeric_value, value_unit, notes
)
select *
from (values
  ('cake-one-floor-sponge-yield', 'torta', 'Rendimiento de bizcocho para 1 piso', 2::numeric, 'bizcochos', 'Una preparación produce dos bizcochos.'),
  ('cake-two-floor-sponge-yield', 'torta', 'Rendimiento de bizcocho para 2 pisos', 3::numeric, 'bizcochos', 'Una preparación produce tres bizcochos.'),
  ('cake-one-floor-fillings', 'torta', 'Rellenos para 1 piso', 1::numeric, 'relleno', 'Una torta de un piso lleva un relleno.'),
  ('cake-two-floor-fillings', 'torta', 'Rellenos para 2 pisos', 2::numeric, 'rellenos', 'Una torta de dos pisos agrega un segundo relleno.'),
  ('buttercream-clear-ratio', 'torta', 'Parte de claras', 1::numeric, 'parte', 'Cobertura buttercream: 1 parte de claras, 2 de azúcar y 2 de manteca.'),
  ('buttercream-sugar-ratio', 'torta', 'Partes de azúcar', 2::numeric, 'partes', 'Cobertura buttercream 1:2:2.'),
  ('buttercream-butter-ratio', 'torta', 'Partes de manteca', 2::numeric, 'partes', 'Cobertura buttercream 1:2:2.'),
  ('tarts-no-small-size', 'tarta', 'Disponibilidad de tamaño chico', 0::numeric, 'tamaños', 'Ninguna tarta tiene tamaño chico.'),
  ('cake-large-packaging', 'torta', 'Packaging grande', 30::numeric, 'cm', 'La torta de 24 cm usa caja y tablita de 30 cm.'),
  ('cake-medium-packaging', 'torta', 'Packaging mediano', 25::numeric, 'cm', 'La torta de 20 cm usa caja y tablita de 25 cm.'),
  ('three-floor-coverage-pending', 'torta', 'Cobertura de 3 pisos', null::numeric, null, 'Se menciona la opción de 3 pisos, pero faltan cantidades para calcularla.'),
  ('marbled-sponge-pending', 'torta', 'Bizcocho marmoleado', null::numeric, null, 'Opción disponible; faltan ingredientes y cantidades.'),
  ('caramelized-sponge-pending', 'torta', 'Bizcocho caramelizado', null::numeric, null, 'Opción disponible; faltan ingredientes y cantidades.')
) as rule(id, family, rule_name, numeric_value, value_unit, notes)
on conflict (id) do update set
  family = excluded.family,
  rule_name = excluded.rule_name,
  numeric_value = excluded.numeric_value,
  value_unit = excluded.value_unit,
  notes = excluded.notes,
  updated_at = now();

create or replace view public.recipe_template_costs
with (security_invoker = true)
as
select
  template.id as template_id,
  template.family,
  template.component_type,
  template.name,
  template.size_code,
  template.diameter_cm,
  template.floor_count,
  template.yield_quantity,
  template.yield_unit,
  template.sort_order,
  template.is_complete as recipe_is_complete,
  count(item.id) as item_count,
  count(cost.effective_unit_cost) as priced_item_count,
  count(item.id) - count(cost.effective_unit_cost) as missing_price_count,
  coalesce(
    array_agg(ingredient.name order by item.sort_order, ingredient.name)
      filter (where item.id is not null and cost.effective_unit_cost is null),
    array[]::text[]
  ) as missing_price_items,
  round(coalesce(sum(item.quantity * cost.effective_unit_cost), 0), 2) as known_cost,
  case
    when not template.is_complete then null
    when count(item.id) = 0 then null
    when count(item.id) <> count(cost.effective_unit_cost) then null
    else round(sum(item.quantity * cost.effective_unit_cost), 2)
  end as total_cost
from public.recipe_templates template
left join public.recipe_template_items item on item.template_id = template.id
left join public.ingredients ingredient on ingredient.id = item.ingredient_id
left join public.current_ingredient_costs cost on cost.id = item.ingredient_id
group by template.id;

grant select on public.recipe_template_costs to authenticated;

comment on table public.recipe_templates is
  'Biblioteca reutilizable de bizcochos, rellenos y coberturas por tamaño y cantidad de pisos.';
comment on view public.recipe_template_costs is
  'Costo actualizado de cada plantilla usando siempre el último precio de cada insumo.';
