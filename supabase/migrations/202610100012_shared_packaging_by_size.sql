-- Afrikísima: packaging compartido por tamaño, no por producto.
-- Ejecutar después de 202610100011_custom_final_prices.sql.
--
-- La planilla de Tartas registra el par de presentación bajo "Caja/tablita":
--   * caja de 24 cm: $2.000
--   * tablita de 22 cm: $4.000
-- Ambos insumos se compran en el Cotillón de Coronado y se reutilizan en todas
-- las recetas de tortas/tartas que emplean esta presentación. Cookies conserva
-- su caja propia porque no usa packaging para tortas.

-- ---------------------------------------------------------------------------
-- Catálogo canónico de packaging
-- ---------------------------------------------------------------------------

with packaging_definitions as (
  select *
  from (values
    (
      'Caja para torta 24 cm',
      '24 cm',
      'Caja compartida por tamaño. Precio manual de la planilla de Tartas; origen: Cotillón de Coronado.'
    ),
    (
      'Tablita para torta 22 cm',
      '22 cm',
      'Tablita compartida por tamaño. Precio manual de la planilla de Tartas; origen: Cotillón de Coronado.'
    )
  ) as supplied_packaging(name, size_label, source_notes)
)
insert into public.ingredients (
  name, base_unit, supply_type, size_label, source_type, source_product_id,
  source_url, auto_update_enabled, source_notes
)
select
  definition.name,
  'unit',
  'packaging',
  definition.size_label,
  null,
  null,
  null,
  false,
  definition.source_notes
from packaging_definitions definition
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

with packaging_prices as (
  select *
  from (values
    ('Caja para torta 24 cm', 2000::numeric),
    ('Tablita para torta 22 cm', 4000::numeric)
  ) as supplied_packaging_price(name, package_price)
)
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  supply.id,
  1,
  price.package_price,
  'Cotillón de Coronado',
  date '2026-10-10',
  null,
  'unit',
  1
from packaging_prices price
join public.ingredients supply on supply.name = price.name
where not exists (
  select 1
  from public.ingredient_prices existing
  where existing.ingredient_id = supply.id
    and existing.package_quantity = 1
    and existing.package_price = price.package_price
    and coalesce(existing.supplier, '') = 'Cotillón de Coronado'
    and existing.purchase_unit = 'unit'
    and existing.conversion_to_base = 1
    and existing.recorded_at = date '2026-10-10'
);

-- ---------------------------------------------------------------------------
-- Sustituye únicamente el packaging precargado por migraciones anteriores.
-- No borra insumos de packaging que una administradora haya creado a mano.
-- ---------------------------------------------------------------------------

with obsolete_seeded_packaging as (
  select *
  from (values
    ('Caja — Torta Personalizada'),
    ('Base/tablita — Torta Personalizada'),
    ('Caja — Burn Away Cake'),
    ('Base/tablita — Burn Away Cake'),
    ('Caja — Glitter Cake'),
    ('Base/tablita — Glitter Cake'),
    ('Caja — Torta Vintage'),
    ('Base/tablita — Torta Vintage'),
    ('Caja — Torta Fondant'),
    ('Base/tablita — Torta Fondant'),
    ('Caja — Tiramisú'),
    ('Base/tablita — Tiramisú'),
    ('Caja — Torta de Ricota'),
    ('Base/tablita — Torta de Ricota'),
    ('Caja — Lemon Pie'),
    ('Base/tablita — Lemon Pie'),
    ('Caja para torta 20 cm'),
    ('Base para torta 20 cm'),
    ('Base para torta 25 cm'),
    ('Packaging pendiente — Torta Chajá'),
    ('Packaging pendiente — Carrot Cake'),
    ('Packaging pendiente — Cheesecake New York'),
    ('Packaging pendiente — Tarta de Frutilla'),
    ('Packaging pendiente — Cookies con Chocolate')
  ) as seeded_packaging(name)
)
delete from public.recipe_items recipe_item
where recipe_item.ingredient_id in (
  select supply.id
  from public.ingredients supply
  join obsolete_seeded_packaging obsolete on obsolete.name = supply.name
);

-- Una caja y una tablita compartidas en cada receta de torta/tarta.
with cake_products as (
  select *
  from (values
    ('personalizada'),
    ('burn-away'),
    ('glitter'),
    ('vintage'),
    ('fondant'),
    ('chaja'),
    ('tiramisu'),
    ('carrot-cake'),
    ('ricota'),
    ('cheesecake-ny'),
    ('lemon-pie'),
    ('frutilla')
  ) as supplied_cake_products(product_id)
),
packaging_map as (
  select *
  from (values
    ('Caja para torta 24 cm'),
    ('Tablita para torta 22 cm')
  ) as supplied_packaging_map(supply_name)
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  1,
  'Packaging compartido por tamaño; origen: Cotillón de Coronado.'
from cake_products product
join public.product_variants variant on variant.product_id = product.product_id
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_sections section
  on section.recipe_id = recipe.id
  and section.name = 'Packaging'
cross join packaging_map mapping
join public.ingredients supply on supply.name = mapping.supply_name
on conflict (recipe_id, section_id, ingredient_id) do update set
  quantity = excluded.quantity,
  quantity_note = excluded.quantity_note;

-- Elimina del catálogo solamente los registros precargados que ya no usa
-- ninguna receta. Su historial de precios se elimina por ON DELETE CASCADE.
with obsolete_seeded_packaging as (
  select *
  from (values
    ('Caja — Torta Personalizada'),
    ('Base/tablita — Torta Personalizada'),
    ('Caja — Burn Away Cake'),
    ('Base/tablita — Burn Away Cake'),
    ('Caja — Glitter Cake'),
    ('Base/tablita — Glitter Cake'),
    ('Caja — Torta Vintage'),
    ('Base/tablita — Torta Vintage'),
    ('Caja — Torta Fondant'),
    ('Base/tablita — Torta Fondant'),
    ('Caja — Tiramisú'),
    ('Base/tablita — Tiramisú'),
    ('Caja — Torta de Ricota'),
    ('Base/tablita — Torta de Ricota'),
    ('Caja — Lemon Pie'),
    ('Base/tablita — Lemon Pie'),
    ('Caja para torta 20 cm'),
    ('Base para torta 20 cm'),
    ('Base para torta 25 cm'),
    ('Packaging pendiente — Torta Chajá'),
    ('Packaging pendiente — Carrot Cake'),
    ('Packaging pendiente — Cheesecake New York'),
    ('Packaging pendiente — Tarta de Frutilla'),
    ('Packaging pendiente — Cookies con Chocolate')
  ) as seeded_packaging(name)
)
delete from public.ingredients supply
where supply.name in (select obsolete.name from obsolete_seeded_packaging obsolete)
  and not exists (
    select 1
    from public.recipe_items recipe_item
    where recipe_item.ingredient_id = supply.id
  );

comment on view public.recipe_cost_completeness is
  'Audita ingredientes y packaging. Las tortas usan caja y tablita compartidas por tamaño.';
