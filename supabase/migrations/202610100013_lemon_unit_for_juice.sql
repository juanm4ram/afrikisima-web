-- Afrikísima: jugo de lima y jugo de limón se costean desde Limón (unidad).
-- Ejecutar después de 202610100012_shared_packaging_by_size.sql.
--
-- No existe un precio independiente para el jugo: se compra el limón entero en
-- Verdulería Tiziana. La equivalencia de la planilla de Lemon Pie es 6 limones
-- para 200 ml de jugo. Las cantidades siguen siendo editables desde el panel.

insert into public.ingredients (
  name, base_unit, supply_type, source_type, source_product_id, source_url,
  auto_update_enabled, source_notes
)
values (
  'Limón',
  'unit',
  'ingredient',
  null,
  null,
  null,
  false,
  'Compra manual por unidad en Verdulería Tiziana. Jugo y ralladura se obtienen de la misma fruta y no tienen un precio independiente.'
)
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
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
  lemon.id,
  6,
  4400,
  'Verdulería Tiziana',
  date '2026-10-10',
  null,
  'unit',
  1
from public.ingredients lemon
where lemon.name = 'Limón'
  and not exists (
    select 1
    from public.ingredient_prices existing
    where existing.ingredient_id = lemon.id
      and existing.package_quantity = 6
      and existing.package_price = 4400
      and coalesce(existing.supplier, '') = 'Verdulería Tiziana'
      and existing.purchase_unit = 'unit'
      and existing.conversion_to_base = 1
      and existing.recorded_at = date '2026-10-10'
  );

-- Si una sección ya tenía Limón, absorbe la cantidad equivalente de jugo sin
-- crear una segunda fila. Se usa el mayor valor porque jugo y ralladura pueden
-- salir de las mismas frutas y no deben cobrarse dos veces.
with juice_items as (
  select
    juice_item.recipe_id,
    juice_item.section_id,
    max(round(juice_item.quantity * 6 / 200, 3)) as lemon_quantity
  from public.recipe_items juice_item
  join public.ingredients juice on juice.id = juice_item.ingredient_id
  where juice.name in ('Jugo de lima', 'Jugo de limón')
  group by juice_item.recipe_id, juice_item.section_id
)
update public.recipe_items lemon_item
set
  quantity = greatest(lemon_item.quantity, juice.lemon_quantity),
  quantity_note = concat_ws(
    ' ',
    nullif(lemon_item.quantity_note, ''),
    'El jugo se costea con Limón por unidad de Verdulería Tiziana.'
  )
from juice_items juice
where lemon_item.recipe_id = juice.recipe_id
  and lemon_item.section_id = juice.section_id
  and lemon_item.ingredient_id = (
    select id from public.ingredients where name = 'Limón'
  );

delete from public.recipe_items juice_item
where juice_item.id in (
  select candidate.id
  from public.recipe_items candidate
  join public.ingredients juice on juice.id = candidate.ingredient_id
  where juice.name in ('Jugo de lima', 'Jugo de limón')
    and exists (
      select 1
      from public.recipe_items lemon_item
      join public.ingredients lemon on lemon.id = lemon_item.ingredient_id
      where lemon.name = 'Limón'
        and lemon_item.recipe_id = candidate.recipe_id
        and lemon_item.section_id = candidate.section_id
    )
);

-- Convierte las filas de jugo restantes a unidades de Limón.
update public.recipe_items recipe_item
set
  ingredient_id = (select id from public.ingredients where name = 'Limón'),
  quantity = round(recipe_item.quantity * 6 / 200, 3),
  quantity_note = concat_ws(
    ' ',
    nullif(recipe_item.quantity_note, ''),
    'Conversión inicial: 200 ml de jugo = 6 limones; editable. Origen: Verdulería Tiziana.'
  )
where recipe_item.ingredient_id in (
  select id
  from public.ingredients
  where name in ('Jugo de lima', 'Jugo de limón')
);

-- Toda referencia directa a Lima también pasa al insumo Limón por unidad.
delete from public.recipe_items lime_item
where lime_item.ingredient_id = (select id from public.ingredients where name = 'Lima')
  and exists (
    select 1
    from public.recipe_items lemon_item
    where lemon_item.recipe_id = lime_item.recipe_id
      and lemon_item.section_id = lime_item.section_id
      and lemon_item.ingredient_id = (
        select id from public.ingredients where name = 'Limón'
      )
  );

update public.recipe_items recipe_item
set
  ingredient_id = (select id from public.ingredients where name = 'Limón'),
  quantity_note = concat_ws(
    ' ',
    nullif(recipe_item.quantity_note, ''),
    'Se compra como Limón por unidad en Verdulería Tiziana.'
  )
where recipe_item.ingredient_id = (
  select id from public.ingredients where name = 'Lima'
);

-- Los nombres derivados dejan de aparecer como insumos seleccionables cuando
-- ya no tienen referencias históricas. Sus precios se eliminan en cascada.
delete from public.ingredients ingredient
where ingredient.name in ('Jugo de lima', 'Jugo de limón', 'Lima')
  and not exists (
    select 1
    from public.recipe_items recipe_item
    where recipe_item.ingredient_id = ingredient.id
  );
