-- Afrikísima: correcciones de insumos del 2026-10-10 y packaging por receta.
-- Ejecutar después de 202610010008_catalog_recipes_and_detailed_costs.sql.
--
-- Criterios importantes:
--   * los precios informados manualmente se agregan al historial; no se borra nada;
--   * solo se automatizan fichas exactas y estables de Carrefour;
--   * arándanos frescos y congelados quedan como insumos distintos;
--   * limón/lima se costean como fruta comprada, no se cobra por separado el jugo
--     y la ralladura de una misma fruta;
--   * caja y base/tablita son recipe_items de tipo packaging, por lo que entran
--     en la misma suma que el resto de los insumos.

-- ---------------------------------------------------------------------------
-- Insumos nuevos y metadatos de sincronización
-- ---------------------------------------------------------------------------

insert into public.ingredients (
  name, base_unit, supply_type, source_type, source_product_id, source_url,
  auto_update_enabled, source_notes
)
values
  (
    'Arándanos congelados', 'g', 'ingredient', 'carrefour_vtex', '728899',
    'https://www.carrefour.com.ar/arandanos-congelados-carrefour-classic-dp-250-g-728899/p',
    true,
    'Arándanos congelados Carrefour Classic 250 g. Es la opción predeterminada en recetas; Arándanos frescos sigue disponible.'
  ),
  (
    'Limón', 'unit', 'ingredient', null, null, null, false,
    'Compra manual en Verdulería Tiziana. El costo representa la fruta completa y evita cobrar dos veces jugo y ralladura.'
  ),
  (
    'Lima', 'unit', 'ingredient', null, null, null, false,
    'Compra manual en Verdulería Tiziana. El costo representa la fruta completa y evita cobrar dos veces jugo y ralladura.'
  )
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
  source_type = excluded.source_type,
  source_product_id = excluded.source_product_id,
  source_url = excluded.source_url,
  auto_update_enabled = excluded.auto_update_enabled,
  source_notes = excluded.source_notes,
  updated_at = now();

-- Fuentes automáticas verificadas contra fichas exactas de Carrefour.
update public.ingredients i
set
  source_type = source.source_type,
  source_product_id = source.source_product_id,
  source_url = source.source_url,
  auto_update_enabled = true,
  source_notes = source.source_notes,
  updated_at = now()
from (values
  (
    'Esencia de vainilla', 'carrefour_vtex', '690049',
    'https://www.carrefour.com.ar/esencia-de-vainilla-alicante-pet-100-cc-690049/p',
    'Esencia de vainilla Alicante 100 cc; precio automático desde Carrefour.'
  ),
  (
    'Azúcar mascabo', 'carrefour_vtex', '643019',
    'https://www.carrefour.com.ar/azucar-mascabo-ledesma-800-g/p',
    'Azúcar mascabo Ledesma 800 g; precio automático desde Carrefour.'
  ),
  (
    'Arándanos congelados', 'carrefour_vtex', '728899',
    'https://www.carrefour.com.ar/arandanos-congelados-carrefour-classic-dp-250-g-728899/p',
    'Arándanos congelados Carrefour Classic 250 g; precio automático desde Carrefour.'
  )
) as source(name, source_type, source_product_id, source_url, source_notes)
where i.name = source.name;

-- Las compras indicadas como manuales dejan de apuntar a productos automáticos
-- anteriores que ya no representan lo que realmente se compra.
update public.ingredients i
set
  source_type = null,
  source_product_id = null,
  source_url = null,
  auto_update_enabled = false,
  source_notes = manual.source_notes,
  updated_at = now()
from (values
  ('Azúcar impalpable', 'Compra manual en Cotillón del Carrefour de Coronado.'),
  ('Colorante rosa', 'Rada Colors; compra manual en Cotillón del Carrefour de Coronado.'),
  ('Frutillas', 'Frutilla fresca; compra manual por kilo en Verdulería Tiziana.'),
  ('Arándanos', 'Arándanos frescos; compra manual de 550 g en Verdulería Tiziana.'),
  ('Papel de arroz', 'Compra manual en Cotillón Almendra.'),
  ('Cacao amargo', 'Compra manual de 500 g en Cotillón Carrefour Coronado.'),
  ('Café', 'Bonafide torrado 500 g. No hay una ficha exacta vigente de 500 g en Carrefour; se mantiene manual.'),
  ('Canela', 'Compra manual de 25 g en Verdulería Tiziana.'),
  ('Nueces', 'Compra manual de 250 g en Verdulería Tiziana.'),
  ('Nuez moscada', 'Compra manual de 25 g en Verdulería Tiziana.'),
  ('Limón', 'Compra manual en Verdulería Tiziana. Precio informado para 6 unidades según la planilla de Lemon Pie.'),
  ('Lima', 'Compra manual en Verdulería Tiziana. Precio informado para 10 unidades según la planilla de Key Lime Pie.')
) as manual(name, source_notes)
where i.name = manual.name;

-- Los cuatro insumos derivados permanecen para no romper presupuestos históricos,
-- pero las recetas precargadas nuevas usan Limón/Lima como fruta completa.
update public.ingredients
set
  auto_update_enabled = false,
  source_type = null,
  source_product_id = null,
  source_url = null,
  source_notes = case name
    when 'Jugo de limón' then 'Insumo histórico. Para recetas nuevas usar Limón (unidad).'
    when 'Ralladura de limón' then 'Insumo histórico. Para recetas nuevas usar Limón (unidad).'
    when 'Jugo de lima' then 'Insumo histórico. Para recetas nuevas usar Lima (unidad).'
    when 'Ralladura de lima' then 'Insumo histórico. Para recetas nuevas usar Lima (unidad).'
  end,
  updated_at = now()
where name in ('Jugo de limón', 'Ralladura de limón', 'Jugo de lima', 'Ralladura de lima');

-- ---------------------------------------------------------------------------
-- Historial de precios corregido
-- ---------------------------------------------------------------------------

with price_updates as (
  select *
  from (values
    ('Azúcar impalpable', 1::numeric, 7100::numeric, 'Cotillón del Carrefour de Coronado', null, 'kg', 1000::numeric, date '2026-10-10'),
    ('Colorante rosa', 5::numeric, 3300::numeric, 'Cotillón del Carrefour de Coronado', 'Rada Colors', 'g', 1::numeric, date '2026-10-10'),
    ('Esencia de vainilla', 100::numeric, 2259::numeric, 'Carrefour Online', 'Alicante', 'ml', 1::numeric, date '2026-10-10'),
    ('Frutillas', 1::numeric, 4400::numeric, 'Verdulería Tiziana', null, 'kg', 1000::numeric, date '2026-10-10'),
    ('Arándanos', 550::numeric, 5000::numeric, 'Verdulería Tiziana', null, 'g', 1::numeric, date '2026-10-10'),
    ('Arándanos congelados', 250::numeric, 5490::numeric, 'Carrefour Online', 'Carrefour Classic', 'g', 1::numeric, date '2026-10-10'),
    ('Azúcar mascabo', 800::numeric, 2749::numeric, 'Carrefour Online', 'Ledesma', 'g', 1::numeric, date '2026-10-10'),
    ('Papel de arroz', 1::numeric, 5500::numeric, 'Cotillón Almendra', null, 'unit', 1::numeric, date '2026-10-10'),
    ('Cacao amargo', 500::numeric, 4000::numeric, 'Cotillón Carrefour Coronado', null, 'g', 1::numeric, date '2026-10-10'),
    ('Café', 500::numeric, 11890::numeric, 'Carrefour Online', 'Bonafide torrado', 'g', 1::numeric, date '2026-10-10'),
    ('Canela', 25::numeric, 1090::numeric, 'Verdulería Tiziana', null, 'g', 1::numeric, date '2026-10-10'),
    ('Nueces', 250::numeric, 5000::numeric, 'Verdulería Tiziana', null, 'g', 1::numeric, date '2026-10-10'),
    ('Nuez moscada', 25::numeric, 1000::numeric, 'Verdulería Tiziana', null, 'g', 1::numeric, date '2026-10-10'),
    ('Limón', 6::numeric, 4400::numeric, 'Verdulería Tiziana', null, 'unit', 1::numeric, date '2026-10-10'),
    ('Lima', 10::numeric, 4400::numeric, 'Verdulería Tiziana', null, 'unit', 1::numeric, date '2026-10-10')
  ) as supplied_price(
    name, package_quantity, package_price, supplier, brand,
    purchase_unit, conversion_to_base, recorded_at
  )
)
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  i.id, p.package_quantity, p.package_price, p.supplier, p.recorded_at,
  p.brand, p.purchase_unit, p.conversion_to_base
from price_updates p
join public.ingredients i on i.name = p.name
where not exists (
  select 1
  from public.ingredient_prices existing
  where existing.ingredient_id = i.id
    and existing.package_quantity = p.package_quantity
    and existing.package_price = p.package_price
    and coalesce(existing.supplier, '') = coalesce(p.supplier, '')
    and coalesce(existing.brand, '') = coalesce(p.brand, '')
    and existing.purchase_unit = p.purchase_unit
    and existing.conversion_to_base = p.conversion_to_base
    and existing.recorded_at = p.recorded_at
);

-- El congelado pasa a ser el arándano predeterminado de las recetas existentes.
-- Si una receta ya tenía ambos, se conserva la fila congelada para evitar una
-- colisión con el índice único (receta, sección, insumo).
delete from public.recipe_items
where id in (
  select fresh_item.id
  from public.recipe_items fresh_item
  join public.ingredients fresh on fresh.id = fresh_item.ingredient_id
  cross join public.ingredients frozen
  where fresh.name = 'Arándanos'
    and frozen.name = 'Arándanos congelados'
    and exists (
      select 1
      from public.recipe_items frozen_item
      where frozen_item.recipe_id = fresh_item.recipe_id
        and frozen_item.section_id = fresh_item.section_id
        and frozen_item.ingredient_id = frozen.id
    )
  );

update public.recipe_items recipe_item
set
  ingredient_id = (
    select id from public.ingredients where name = 'Arándanos congelados'
  ),
  quantity_note = concat_ws(
    ' ', nullif(recipe_item.quantity_note, ''),
    'Arándano congelado predeterminado; se puede cambiar por Arándanos frescos desde el panel.'
  )
where recipe_item.ingredient_id = (
  select id from public.ingredients where name = 'Arándanos'
);

-- Lemon Pie y Ricota ahora costean la fruta una sola vez. La ralladura sale de
-- los mismos limones usados para el jugo; mantener filas separadas duplicaría el costo.
delete from public.recipe_items
where id in (
  select recipe_item.id
  from public.recipe_items recipe_item
  join public.recipes recipe on recipe.id = recipe_item.recipe_id
  join public.product_variants variant on variant.id = recipe.variant_id
  join public.ingredients old_supply on old_supply.id = recipe_item.ingredient_id
  where variant.product_id in ('lemon-pie', 'ricota')
    and old_supply.name in ('Jugo de limón', 'Ralladura de limón')
);

insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  lemon.id,
  case
    when variant.product_id = 'lemon-pie' and variant.code = 'grande' then 6::numeric
    when variant.product_id = 'lemon-pie' then 3.375::numeric
    when variant.product_id = 'ricota' and variant.code = 'grande' then 1::numeric
    else 0.563::numeric
  end,
  case
    when variant.product_id = 'lemon-pie'
      then 'Incluye el jugo y la ralladura de la receta; la fruta se costea una sola vez.'
    else 'Limón usado para la ralladura del relleno.'
  end
from public.recipes recipe
join public.product_variants variant on variant.id = recipe.variant_id
join public.recipe_sections section
  on section.recipe_id = recipe.id
  and section.name = 'Relleno'
join public.ingredients lemon on lemon.name = 'Limón'
where variant.product_id in ('lemon-pie', 'ricota')
on conflict (recipe_id, section_id, ingredient_id) do update set
  quantity = excluded.quantity,
  quantity_note = excluded.quantity_note;

-- Mantiene explícitamente la corrección de manteca del Lemon Pie: 150 g en la
-- base y 50 g en el relleno para la referencia de 24 cm; la mediana se escala
-- por superficie (18/24)^2.
with butter_corrections as (
  select
    recipe_item.id,
    case
      when variant.code = 'grande' and section.name = 'Bizcocho' then 150::numeric
      when variant.code = 'grande' and section.name = 'Relleno' then 50::numeric
      when variant.code = 'mediano' and section.name = 'Bizcocho' then 84.375::numeric
      when variant.code = 'mediano' and section.name = 'Relleno' then 28.125::numeric
      else recipe_item.quantity
    end as corrected_quantity
  from public.recipe_items recipe_item
  join public.recipes recipe on recipe.id = recipe_item.recipe_id
  join public.product_variants variant on variant.id = recipe.variant_id
  join public.recipe_sections section on section.id = recipe_item.section_id
  join public.ingredients butter on butter.id = recipe_item.ingredient_id
  where butter.name = 'Manteca'
    and variant.product_id = 'lemon-pie'
    and section.name in ('Bizcocho', 'Relleno')
)
update public.recipe_items recipe_item
set quantity = correction.corrected_quantity
from butter_corrections correction
where recipe_item.id = correction.id;

-- ---------------------------------------------------------------------------
-- Packaging respaldado por las planillas
-- ---------------------------------------------------------------------------

with packaging_definitions as (
  select *
  from (values
    ('Caja — Torta Personalizada', 'Referencia 16 cm'),
    ('Base/tablita — Torta Personalizada', 'Referencia 16 cm'),
    ('Caja — Burn Away Cake', 'Referencia 24 cm'),
    ('Base/tablita — Burn Away Cake', 'Referencia 24 cm'),
    ('Caja — Glitter Cake', 'Referencia 24 cm'),
    ('Base/tablita — Glitter Cake', 'Referencia 24 cm'),
    ('Caja — Torta Vintage', 'Referencia 20 cm'),
    ('Base/tablita — Torta Vintage', 'Referencia 20 cm'),
    ('Caja — Torta Fondant', 'Referencia de la planilla'),
    ('Base/tablita — Torta Fondant', 'Referencia de la planilla'),
    ('Caja — Tiramisú', 'Referencia 17 cm'),
    ('Base/tablita — Tiramisú', 'Referencia 17 cm'),
    ('Caja — Torta de Ricota', 'Referencia 24 cm'),
    ('Base/tablita — Torta de Ricota', 'Referencia 24 cm'),
    ('Caja — Lemon Pie', 'Referencia 24 cm'),
    ('Base/tablita — Lemon Pie', 'Referencia 24 cm')
  ) as supplied_packaging(name, size_label)
)
insert into public.ingredients (name, base_unit, supply_type, size_label, source_notes)
select
  definition.name,
  'unit',
  'packaging',
  definition.size_label,
  'Precio de packaging tomado de la planilla de referencia; editable desde el panel.'
from packaging_definitions definition
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
  size_label = excluded.size_label,
  source_notes = excluded.source_notes,
  updated_at = now();

with packaging_prices as (
  select *
  from (values
    ('Caja — Torta Personalizada', 5000::numeric),
    ('Base/tablita — Torta Personalizada', 3000::numeric),
    ('Caja — Burn Away Cake', 2400::numeric),
    ('Base/tablita — Burn Away Cake', 2600::numeric),
    ('Caja — Glitter Cake', 2400::numeric),
    ('Base/tablita — Glitter Cake', 2600::numeric),
    ('Caja — Torta Vintage', 4000::numeric),
    ('Base/tablita — Torta Vintage', 2500::numeric),
    ('Caja — Torta Fondant', 2300::numeric),
    ('Base/tablita — Torta Fondant', 1900::numeric),
    ('Caja — Tiramisú', 2300::numeric),
    ('Base/tablita — Tiramisú', 1900::numeric),
    ('Caja — Torta de Ricota', 2000::numeric),
    ('Base/tablita — Torta de Ricota', 4000::numeric),
    ('Caja — Lemon Pie', 2000::numeric),
    ('Base/tablita — Lemon Pie', 4000::numeric)
  ) as supplied_packaging_price(name, package_price)
)
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  supply.id, 1, price.package_price, 'Planilla de referencia', date '2026-10-10',
  null, 'unit', 1
from packaging_prices price
join public.ingredients supply on supply.name = price.name
where not exists (
  select 1
  from public.ingredient_prices existing
  where existing.ingredient_id = supply.id
    and existing.package_quantity = 1
    and existing.package_price = price.package_price
    and existing.purchase_unit = 'unit'
    and existing.conversion_to_base = 1
    and existing.recorded_at = date '2026-10-10'
);

-- Solo precarga el par caja/base si la receta todavía no tiene ningún packaging.
-- De esta manera no se duplica un packaging que la administradora haya cargado.
with packaging_map as (
  select *
  from (values
    ('personalizada', 'Caja — Torta Personalizada'),
    ('personalizada', 'Base/tablita — Torta Personalizada'),
    ('burn-away', 'Caja — Burn Away Cake'),
    ('burn-away', 'Base/tablita — Burn Away Cake'),
    ('glitter', 'Caja — Glitter Cake'),
    ('glitter', 'Base/tablita — Glitter Cake'),
    ('vintage', 'Caja — Torta Vintage'),
    ('vintage', 'Base/tablita — Torta Vintage'),
    ('fondant', 'Caja — Torta Fondant'),
    ('fondant', 'Base/tablita — Torta Fondant'),
    ('tiramisu', 'Caja — Tiramisú'),
    ('tiramisu', 'Base/tablita — Tiramisú'),
    ('ricota', 'Caja — Torta de Ricota'),
    ('ricota', 'Base/tablita — Torta de Ricota'),
    ('lemon-pie', 'Caja — Lemon Pie'),
    ('lemon-pie', 'Base/tablita — Lemon Pie')
  ) as supplied_packaging_map(product_id, supply_name)
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  1,
  'Packaging de referencia; revisar el tamaño y precio si cambia la presentación.'
from packaging_map mapping
join public.product_variants variant on variant.product_id = mapping.product_id
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_sections section
  on section.recipe_id = recipe.id and section.name = 'Packaging'
join public.ingredients supply on supply.name = mapping.supply_name
where not exists (
  select 1
  from public.recipe_items existing_item
  join public.ingredients existing_supply on existing_supply.id = existing_item.ingredient_id
  where existing_item.recipe_id = recipe.id
    and existing_supply.supply_type = 'packaging'
)
on conflict (recipe_id, section_id, ingredient_id) do nothing;

-- Para los productos publicados sin información de packaging en las planillas,
-- se crea una fila visible y sin precio. Así el panel no publica un sugerido
-- incompleto y muestra exactamente qué dato falta cargar.
with pending_packaging as (
  select *
  from (values
    ('chaja', 'Torta Chajá'),
    ('carrot-cake', 'Carrot Cake'),
    ('cheesecake-ny', 'Cheesecake New York'),
    ('frutilla', 'Tarta de Frutilla'),
    ('cookies', 'Cookies con Chocolate')
  ) as supplied_pending_packaging(product_id, product_name)
)
insert into public.ingredients (name, base_unit, supply_type, size_label, source_notes)
select
  'Packaging pendiente — ' || pending.product_name,
  'unit',
  'packaging',
  'Definir caja y base para esta presentación',
  'No hay un costo de packaging para este producto en las planillas proporcionadas.'
from pending_packaging pending
on conflict (name) do update set
  supply_type = excluded.supply_type,
  size_label = excluded.size_label,
  source_notes = excluded.source_notes,
  updated_at = now();

with pending_packaging as (
  select *
  from (values
    ('chaja', 'Torta Chajá'),
    ('carrot-cake', 'Carrot Cake'),
    ('cheesecake-ny', 'Cheesecake New York'),
    ('frutilla', 'Tarta de Frutilla'),
    ('cookies', 'Cookies con Chocolate')
  ) as supplied_pending_packaging(product_id, product_name)
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  1,
  'Falta cargar el precio real de caja y base; el precio sugerido queda pendiente.'
from pending_packaging pending
join public.product_variants variant on variant.product_id = pending.product_id
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_sections section
  on section.recipe_id = recipe.id and section.name = 'Packaging'
join public.ingredients supply
  on supply.name = 'Packaging pendiente — ' || pending.product_name
where not exists (
  select 1
  from public.recipe_items existing_item
  join public.ingredients existing_supply on existing_supply.id = existing_item.ingredient_id
  where existing_item.recipe_id = recipe.id
    and existing_supply.supply_type = 'packaging'
)
on conflict (recipe_id, section_id, ingredient_id) do nothing;

-- ---------------------------------------------------------------------------
-- Auditoría: permite comprobar que ingredientes Y packaging entran en el costo
-- ---------------------------------------------------------------------------

create or replace view public.recipe_cost_completeness
with (security_invoker = true)
as
select
  recipe.id as recipe_id,
  recipe.variant_id,
  sum(case when supply.supply_type = 'ingredient' then 1 else 0 end) as ingredient_item_count,
  sum(case when supply.supply_type = 'packaging' then 1 else 0 end) as packaging_item_count,
  sum(case
    when recipe_item.id is not null and cost.effective_unit_cost is null then 1
    else 0
  end) as missing_price_count,
  coalesce(sum(case
    when supply.supply_type = 'ingredient'
      then recipe_item.quantity * cost.effective_unit_cost
    else 0
  end), 0) as ingredient_cost,
  coalesce(sum(case
    when supply.supply_type = 'packaging'
      then recipe_item.quantity * cost.effective_unit_cost
    else 0
  end), 0) as packaging_cost,
  coalesce(sum(recipe_item.quantity * cost.effective_unit_cost), 0) as total_known_supply_cost,
  (
    sum(case when supply.supply_type = 'ingredient' then 1 else 0 end) > 0
    and sum(case when supply.supply_type = 'packaging' then 1 else 0 end) > 0
    and sum(case
      when recipe_item.id is not null and cost.effective_unit_cost is null then 1
      else 0
    end) = 0
  ) as is_complete
from public.recipes recipe
left join public.recipe_items recipe_item on recipe_item.recipe_id = recipe.id
left join public.ingredients supply on supply.id = recipe_item.ingredient_id
left join public.current_ingredient_costs cost on cost.id = supply.id
group by recipe.id, recipe.variant_id;

grant select on public.recipe_cost_completeness to authenticated;

comment on view public.recipe_cost_completeness is
  'Audita por receta que ingredientes y packaging estén incluidos y tengan precio.';

