-- Afrikísima: completa las recetas publicadas que no podían calcular precio.
-- Ejecutar después de 202610100009_supply_corrections_and_packaging.sql.
--
-- Las recetas cargadas aquí son bases editables. Las tortas usan una referencia
-- de 24 cm y la variante de 18 cm se escala por superficie: (18 / 24) ^ 2.
-- Cookies usa una receta de 12 unidades y escala la caja x6 al 50 %.
-- Todo precio se sigue resolviendo desde el último registro de ingredient_prices.

-- ---------------------------------------------------------------------------
-- Insumos que faltaban o estaban sin precio
-- ---------------------------------------------------------------------------

insert into public.ingredients (
  name, base_unit, supply_type, source_type, source_product_id, source_url,
  auto_update_enabled, source_notes
)
values
  (
    'Zanahoria', 'g', 'ingredient', 'carrefour_vtex', '615070',
    'https://www.carrefour.com.ar/zanahoria-huella-natural-x-kg/p',
    true,
    'Zanahoria Huella Natural por kilo. Precio automático desde Carrefour.'
  ),
  (
    'Colorante negro', 'g', 'ingredient', null, null,
    'https://cotillonmartin.com.ar/tienda/reposteria-accesorios-de-cocina/reposteria-materia-prima-rellenos/reposteria-materia-prima-colorantes-comestibles/colorante-en-gel-radha-negro-x-15-grs/',
    false,
    'Colorante en gel Radha negro x 15 g. Fuente manual: Cotillón Martín.'
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

with missing_supply_prices as (
  select *
  from (values
    (
      'Zanahoria', 1::numeric, 2590::numeric, 'Carrefour Online',
      'Huella Natural', 'kg', 1000::numeric, date '2026-10-10'
    ),
    (
      'Colorante negro', 15::numeric, 2300::numeric, 'Cotillón Martín',
      'Radha', 'g', 1::numeric, date '2026-10-10'
    )
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
  supply.id,
  price.package_quantity,
  price.package_price,
  price.supplier,
  price.recorded_at,
  price.brand,
  price.purchase_unit,
  price.conversion_to_base
from missing_supply_prices price
join public.ingredients supply on supply.name = price.name
where not exists (
  select 1
  from public.ingredient_prices existing
  where existing.ingredient_id = supply.id
    and existing.package_quantity = price.package_quantity
    and existing.package_price = price.package_price
    and coalesce(existing.supplier, '') = coalesce(price.supplier, '')
    and coalesce(existing.brand, '') = coalesce(price.brand, '')
    and existing.purchase_unit = price.purchase_unit
    and existing.conversion_to_base = price.conversion_to_base
    and existing.recorded_at = price.recorded_at
);

-- ---------------------------------------------------------------------------
-- Packaging real para las cinco familias que tenían "Packaging pendiente"
-- ---------------------------------------------------------------------------

with packaging_definitions as (
  select *
  from (values
    (
      'Caja para torta 20 cm', '20 x 20 x 20 cm',
      'https://emporiopackaging.com.ar/productos/caja-torta-alta-20x20x20-cm/',
      'Caja alta para torta de 18 cm. Fuente y precio manuales: Emporio Distribuciones.'
    ),
    (
      'Base para torta 20 cm', 'Redonda, 20 cm, fibroplus 3 mm',
      'https://emporiopackaging.com.ar/bandejas-bases-soportes/',
      'Base para torta de 18 cm. Fuente y precio manuales: Emporio Distribuciones.'
    ),
    (
      'Caja para torta 24 cm', '24 x 24 x 10 cm',
      'https://www.croquembouche.com.ar/productos/caja-para-tortas-tartas-20x20x11-cm/',
      'Caja para torta/tarta de 24 cm. Precio de la presentación 24 x 24 x 10 cm de la misma tienda; revisión manual.'
    ),
    (
      'Base para torta 25 cm', 'Redonda, 25 cm, fibroplus 3 mm',
      'https://emporiopackaging.com.ar/bandejas-bases-soportes/',
      'Base de 25 cm para torta de 24 cm. Fuente y precio manuales: Emporio Distribuciones.'
    ),
    (
      'Caja para 6 cookies', '28 x 18 x 8 cm',
      'https://envatermpackaging.mitiendanube.com/productos/caja-para-cookies/',
      'Caja para 6 cookies; pack de 25 unidades. Fuente y precio manuales: Envaterm Packaging.'
    )
  ) as supplied_packaging(name, size_label, source_url, source_notes)
)
insert into public.ingredients (
  name, base_unit, supply_type, size_label, source_url,
  auto_update_enabled, source_notes
)
select
  definition.name,
  'unit',
  'packaging',
  definition.size_label,
  definition.source_url,
  false,
  definition.source_notes
from packaging_definitions definition
on conflict (name) do update set
  base_unit = excluded.base_unit,
  supply_type = excluded.supply_type,
  size_label = excluded.size_label,
  source_type = null,
  source_product_id = null,
  source_url = excluded.source_url,
  auto_update_enabled = false,
  source_notes = excluded.source_notes,
  updated_at = now();

with packaging_prices as (
  select *
  from (values
    ('Caja para torta 20 cm', 1::numeric, 1111::numeric, 'Emporio Distribuciones'),
    ('Base para torta 20 cm', 1::numeric, 1222::numeric, 'Emporio Distribuciones'),
    ('Caja para torta 24 cm', 1::numeric, 2214::numeric, 'Croquembouche'),
    ('Base para torta 25 cm', 1::numeric, 1556::numeric, 'Emporio Distribuciones'),
    ('Caja para 6 cookies', 25::numeric, 42900::numeric, 'Envaterm Packaging')
  ) as supplied_packaging_price(name, package_quantity, package_price, supplier)
)
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  supply.id,
  price.package_quantity,
  price.package_price,
  price.supplier,
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
    and existing.package_quantity = price.package_quantity
    and existing.package_price = price.package_price
    and coalesce(existing.supplier, '') = price.supplier
    and existing.purchase_unit = 'unit'
    and existing.conversion_to_base = 1
    and existing.recorded_at = date '2026-10-10'
);

-- Quita de las recetas la fila artificial sin precio creada por la migración
-- anterior. Los insumos quedan en el catálogo para conservar trazabilidad.
delete from public.recipe_items
where id in (
  select recipe_item.id
  from public.recipe_items recipe_item
  join public.recipes recipe on recipe.id = recipe_item.recipe_id
  join public.product_variants variant on variant.id = recipe.variant_id
  join public.ingredients supply on supply.id = recipe_item.ingredient_id
  where variant.product_id in (
    'chaja', 'carrot-cake', 'cheesecake-ny', 'frutilla', 'cookies'
  )
    and supply.name like 'Packaging pendiente — %'
);

-- ---------------------------------------------------------------------------
-- Secciones y metadatos de las recetas base
-- ---------------------------------------------------------------------------

insert into public.recipe_sections (recipe_id, name, sort_order)
select recipe.id, section_data.name, section_data.sort_order
from public.recipes recipe
join public.product_variants variant on variant.id = recipe.variant_id
cross join (values
  ('Bizcocho', 10),
  ('Relleno', 20),
  ('Cobertura', 30),
  ('Packaging', 40)
) as section_data(name, sort_order)
where variant.product_id in (
  'chaja', 'carrot-cake', 'cheesecake-ny', 'frutilla', 'cookies'
)
on conflict (recipe_id, name) do nothing;

update public.recipes recipe
set
  servings = case
    when variant.product_id = 'cookies' and variant.code = 'mediano' then 6
    when variant.product_id = 'cookies' then 12
    when variant.code = 'mediano' then 12
    else 20
  end,
  notes = case variant.product_id
    when 'chaja' then
      'Receta base editable. Fuente principal: Torta Chajá de Juan Manuel Herrera (elGourmet), molde 24 cm. El merengue seco se costea como claras y azúcar; la variante de 18 cm se escala por superficie.'
    when 'carrot-cake' then
      'Receta base editable. Fuente principal: Carrot Cake de La Bioteca, molde 24 cm; adaptada al producto de Afrikísima con nueces y cobertura suficiente de queso crema. La variante de 18 cm se escala por superficie.'
    when 'cheesecake-ny' then
      'Receta base editable. Fuente principal: Cheesecake estilo New York de Lucila Baldan (Cookpad), apta para molde de 22/24/26 cm. La cobertura se costea como compota de arándanos congelados. La variante de 18 cm se escala por superficie.'
    when 'frutilla' then
      'Receta base editable. Fuente principal: Tarta de frutillas de Johanna Prato, molde 24 cm. La variante de 18 cm se escala por superficie.'
    when 'cookies' then
      'Receta base editable. Fuente principal: Cookies de chocolate de Receiteria, rendimiento 12 unidades; adaptada a azúcar mascabo y Chocolate Aguila. La caja x6 usa media receta.'
  end,
  updated_at = now()
from public.product_variants variant
where variant.id = recipe.variant_id
  and variant.product_id in (
    'chaja', 'carrot-cake', 'cheesecake-ny', 'frutilla', 'cookies'
  )
  and (
    recipe.notes is null
    or recipe.notes like 'Pendiente: los archivos proporcionados%'
  );

-- ---------------------------------------------------------------------------
-- Cantidades base. No pisa filas que la administradora ya haya modificado.
-- ---------------------------------------------------------------------------

with source_items as (
  select *
  from (values
    -- Chajá, referencia de 24 cm.
    ('chaja', 'Bizcocho', 'Huevos', 4::numeric, 'La fuente expresa 220 g; se convierte a 4 huevos de 55 g.'),
    ('chaja', 'Bizcocho', 'Azúcar', 120::numeric, null),
    ('chaja', 'Bizcocho', 'Harina 0000', 120::numeric, null),
    ('chaja', 'Bizcocho', 'Manteca', 20::numeric, null),
    ('chaja', 'Bizcocho', 'Esencia de vainilla', 5::numeric, 'C/N en la fuente; 5 ml es un valor inicial editable.'),
    ('chaja', 'Relleno', 'Crema para batir', 400::numeric, null),
    ('chaja', 'Relleno', 'Azúcar impalpable', 80::numeric, null),
    ('chaja', 'Relleno', 'Dulce de leche repostero', 300::numeric, null),
    ('chaja', 'Relleno', 'Duraznos en almíbar', 500::numeric, null),
    ('chaja', 'Relleno', 'Claras de huevo', 120::numeric, 'Parte del merengue seco: aproximación 1 parte de claras y 2 de azúcar.'),
    ('chaja', 'Relleno', 'Azúcar', 240::numeric, 'Parte del merengue seco: aproximación 1 parte de claras y 2 de azúcar.'),
    ('chaja', 'Cobertura', 'Crema para batir', 200::numeric, null),
    ('chaja', 'Cobertura', 'Azúcar impalpable', 40::numeric, null),
    ('chaja', 'Cobertura', 'Dulce de leche repostero', 200::numeric, null),
    ('chaja', 'Cobertura', 'Duraznos en almíbar', 300::numeric, null),
    ('chaja', 'Cobertura', 'Claras de huevo', 80::numeric, 'Parte del merengue seco: aproximación 1 parte de claras y 2 de azúcar.'),
    ('chaja', 'Cobertura', 'Azúcar', 160::numeric, 'Parte del merengue seco: aproximación 1 parte de claras y 2 de azúcar.'),

    -- Carrot Cake, referencia de 24 cm.
    ('carrot-cake', 'Bizcocho', 'Zanahoria', 350::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Huevos', 3::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Azúcar mascabo', 220::numeric, 'Adaptación coherente con la descripción del producto.'),
    ('carrot-cake', 'Bizcocho', 'Esencia de vainilla', 5::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Aceite', 200::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Harina 0000', 350::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Polvo de hornear', 8::numeric, 'Equivalencia editable para una cucharada de postre.'),
    ('carrot-cake', 'Bizcocho', 'Bicarbonato de sodio', 10::numeric, 'Equivalencia editable para dos cucharadas de postre.'),
    ('carrot-cake', 'Bizcocho', 'Canela', 6::numeric, null),
    ('carrot-cake', 'Bizcocho', 'Nueces', 100::numeric, 'Adaptación editable de Afrikísima.'),
    ('carrot-cake', 'Relleno', 'Queso crema', 300::numeric, null),
    ('carrot-cake', 'Relleno', 'Azúcar impalpable', 50::numeric, null),
    ('carrot-cake', 'Cobertura', 'Queso crema', 300::numeric, null),
    ('carrot-cake', 'Cobertura', 'Azúcar impalpable', 75::numeric, null),

    -- Cheesecake New York, referencia de 24 cm.
    ('cheesecake-ny', 'Bizcocho', 'Galletitas de vainilla', 400::numeric, null),
    ('cheesecake-ny', 'Bizcocho', 'Manteca', 200::numeric, null),
    ('cheesecake-ny', 'Relleno', 'Queso crema', 900::numeric, null),
    ('cheesecake-ny', 'Relleno', 'Crema para batir', 200::numeric, null),
    ('cheesecake-ny', 'Relleno', 'Azúcar', 200::numeric, null),
    ('cheesecake-ny', 'Relleno', 'Huevos', 5::numeric, null),
    ('cheesecake-ny', 'Relleno', 'Esencia de vainilla', 5::numeric, 'C/N en la fuente; 5 ml es un valor inicial editable.'),
    ('cheesecake-ny', 'Relleno', 'Almidón de maíz', 40::numeric, 'La fuente admite harina o fécula; se elige almidón de maíz.'),
    ('cheesecake-ny', 'Cobertura', 'Arándanos congelados', 300::numeric, 'Compota editable en reemplazo del frasco de mermelada sin peso indicado.'),
    ('cheesecake-ny', 'Cobertura', 'Azúcar', 60::numeric, null),
    ('cheesecake-ny', 'Cobertura', 'Gelatina sin sabor', 7::numeric, null),

    -- Tarta de Frutilla, referencia de 24 cm.
    ('frutilla', 'Bizcocho', 'Manteca', 110::numeric, null),
    ('frutilla', 'Bizcocho', 'Azúcar', 80::numeric, null),
    ('frutilla', 'Bizcocho', 'Yemas', 40::numeric, 'Dos yemas, estimadas en 20 g cada una.'),
    ('frutilla', 'Bizcocho', 'Harina 0000', 180::numeric, null),
    ('frutilla', 'Bizcocho', 'Esencia de vainilla', 5::numeric, 'C/N en la fuente; 5 ml es un valor inicial editable.'),
    ('frutilla', 'Bizcocho', 'Sal fina', 1::numeric, 'Una pizca.'),
    ('frutilla', 'Relleno', 'Leche', 250::numeric, null),
    ('frutilla', 'Relleno', 'Azúcar', 70::numeric, null),
    ('frutilla', 'Relleno', 'Yemas', 40::numeric, 'Dos yemas, estimadas en 20 g cada una.'),
    ('frutilla', 'Relleno', 'Almidón de maíz', 15::numeric, null),
    ('frutilla', 'Relleno', 'Esencia de vainilla', 5::numeric, 'C/N en la fuente; 5 ml es un valor inicial editable.'),
    ('frutilla', 'Relleno', 'Crema para batir', 150::numeric, null),
    ('frutilla', 'Cobertura', 'Frutillas', 350::numeric, 'La fuente indica entre 300 y 400 g; se usa el punto medio.'),

    -- Cookies con chocolate, referencia de 12 unidades.
    ('cookies', 'Bizcocho', 'Manteca', 100::numeric, null),
    ('cookies', 'Bizcocho', 'Azúcar mascabo', 200::numeric, 'La fuente usa azúcar; se adapta a mascabo para coincidir con el producto publicado.'),
    ('cookies', 'Bizcocho', 'Huevos', 2::numeric, null),
    ('cookies', 'Bizcocho', 'Esencia de vainilla', 5::numeric, null),
    ('cookies', 'Bizcocho', 'Harina 0000', 180::numeric, null),
    ('cookies', 'Bizcocho', 'Cacao amargo', 28::numeric, 'Equivalencia aproximada de cuatro cucharadas.'),
    ('cookies', 'Bizcocho', 'Bicarbonato de sodio', 5::numeric, 'Una cucharadita rasa.'),
    ('cookies', 'Bizcocho', 'Sal fina', 1::numeric, 'Una cucharadita de café; cantidad inicial editable.'),
    ('cookies', 'Bizcocho', 'Chocolate Aguila', 300::numeric, 'Suma del chocolate derretido y las gotas de chocolate de la fuente.')
  ) as supplied_item(
    product_id, section_name, ingredient_name, source_quantity, quantity_note
  )
), scaled_items as (
  select
    source_item.*,
    variant.id as variant_id,
    case
      when variant.product_id = 'cookies' and variant.code = 'mediano' then 0.5::numeric
      when variant.product_id = 'cookies' then 1::numeric
      when variant.code = 'mediano' then 0.5625::numeric
      else 1::numeric
    end as scale_factor
  from source_items source_item
  join public.product_variants variant
    on variant.product_id = source_item.product_id
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  round(item.source_quantity * item.scale_factor, 3),
  item.quantity_note
from scaled_items item
join public.recipes recipe on recipe.variant_id = item.variant_id
join public.recipe_sections section
  on section.recipe_id = recipe.id
  and section.name = item.section_name
join public.ingredients supply on supply.name = item.ingredient_name
on conflict (recipe_id, section_id, ingredient_id) do nothing;

-- Packaging por variante. Las tortas de 18 cm usan caja/base de 20 cm; las de
-- 24 cm usan caja de 24 cm y base de 25 cm. La caja x12 de cookies usa dos
-- cajas x6 hasta que exista una presentación propia cargada por la administradora.
with packaging_map as (
  select *
  from (values
    ('chaja', 'mediano', 'Caja para torta 20 cm', 1::numeric),
    ('chaja', 'mediano', 'Base para torta 20 cm', 1::numeric),
    ('chaja', 'grande', 'Caja para torta 24 cm', 1::numeric),
    ('chaja', 'grande', 'Base para torta 25 cm', 1::numeric),
    ('carrot-cake', 'mediano', 'Caja para torta 20 cm', 1::numeric),
    ('carrot-cake', 'mediano', 'Base para torta 20 cm', 1::numeric),
    ('carrot-cake', 'grande', 'Caja para torta 24 cm', 1::numeric),
    ('carrot-cake', 'grande', 'Base para torta 25 cm', 1::numeric),
    ('cheesecake-ny', 'mediano', 'Caja para torta 20 cm', 1::numeric),
    ('cheesecake-ny', 'mediano', 'Base para torta 20 cm', 1::numeric),
    ('cheesecake-ny', 'grande', 'Caja para torta 24 cm', 1::numeric),
    ('cheesecake-ny', 'grande', 'Base para torta 25 cm', 1::numeric),
    ('frutilla', 'mediano', 'Caja para torta 20 cm', 1::numeric),
    ('frutilla', 'mediano', 'Base para torta 20 cm', 1::numeric),
    ('frutilla', 'grande', 'Caja para torta 24 cm', 1::numeric),
    ('frutilla', 'grande', 'Base para torta 25 cm', 1::numeric),
    ('cookies', 'mediano', 'Caja para 6 cookies', 1::numeric),
    ('cookies', 'grande', 'Caja para 6 cookies', 2::numeric)
  ) as supplied_packaging_map(
    product_id, variant_code, supply_name, quantity
  )
)
insert into public.recipe_items (
  recipe_id, section_id, ingredient_id, quantity, quantity_note
)
select
  recipe.id,
  section.id,
  supply.id,
  mapping.quantity,
  case
    when mapping.product_id = 'cookies' and mapping.variant_code = 'grande'
      then 'Dos cajas x6 para completar la presentación x12; editable.'
    else 'Packaging de referencia con fuente y precio registrados; editable.'
  end
from packaging_map mapping
join public.product_variants variant
  on variant.product_id = mapping.product_id
  and variant.code = mapping.variant_code
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_sections section
  on section.recipe_id = recipe.id
  and section.name = 'Packaging'
join public.ingredients supply on supply.name = mapping.supply_name
where not exists (
  select 1
  from public.recipe_items existing_item
  join public.ingredients existing_supply
    on existing_supply.id = existing_item.ingredient_id
  where existing_item.recipe_id = recipe.id
    and existing_supply.supply_type = 'packaging'
)
on conflict (recipe_id, section_id, ingredient_id) do nothing;

-- Auditoría legible de cualquier bloqueo restante en recetas publicadas.
create or replace view public.published_recipe_price_blockers
with (security_invoker = true)
as
select
  product.name as product_name,
  variant.id as variant_id,
  variant.label as variant_label,
  recipe.id as recipe_id,
  completeness.ingredient_item_count,
  completeness.packaging_item_count,
  completeness.missing_price_count,
  coalesce(
    string_agg(
      case when cost.effective_unit_cost is null then supply.name end,
      ', ' order by supply.name
    ),
    ''
  ) as supplies_without_price,
  case
    when completeness.ingredient_item_count = 0 then 'Sin ingredientes'
    when completeness.packaging_item_count = 0 then 'Sin packaging'
    when completeness.missing_price_count > 0 then 'Hay insumos sin precio'
    else 'Completa'
  end as status
from public.products product
join public.product_variants variant on variant.product_id = product.id
join public.recipes recipe on recipe.variant_id = variant.id
join public.recipe_cost_completeness completeness on completeness.recipe_id = recipe.id
left join public.recipe_items recipe_item on recipe_item.recipe_id = recipe.id
left join public.ingredients supply on supply.id = recipe_item.ingredient_id
left join public.current_ingredient_costs cost on cost.id = supply.id
where product.is_published and variant.is_published
group by
  product.name,
  variant.id,
  variant.label,
  recipe.id,
  completeness.ingredient_item_count,
  completeness.packaging_item_count,
  completeness.missing_price_count;

grant select on public.published_recipe_price_blockers to authenticated;

comment on view public.published_recipe_price_blockers is
  'Muestra por variante publicada si faltan ingredientes, packaging o precios antes de publicar el sugerido.';
