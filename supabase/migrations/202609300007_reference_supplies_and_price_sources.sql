-- Afrikísima: precarga de insumos de referencia y fuentes de precios automáticas.
-- Ejecutar después de 202609110006_supplies.sql.

alter table public.ingredients
  add column if not exists source_type text
    check (source_type is null or source_type in ('carrefour_vtex', 'valentino_html')),
  add column if not exists source_product_id text,
  add column if not exists source_url text,
  add column if not exists auto_update_enabled boolean not null default false,
  add column if not exists source_notes text,
  add column if not exists last_price_sync_at timestamptz,
  add column if not exists last_price_sync_status text
    check (last_price_sync_status is null or last_price_sync_status in ('ok', 'unchanged', 'error')),
  add column if not exists last_price_sync_message text;

create temporary table reference_supplies (
  name text primary key,
  base_unit text not null,
  brand text,
  purchase_unit text not null,
  package_quantity numeric not null,
  conversion_to_base numeric not null,
  package_price numeric not null,
  supplier text,
  source_type text,
  source_product_id text,
  source_url text,
  auto_update_enabled boolean not null,
  source_notes text
) on commit drop;

insert into reference_supplies values
  ('Aceite', 'ml', 'Carrefour Classic', 'ml', 900, 1, 1790.63, 'Carrefour Online', 'carrefour_vtex', '757629', 'https://www.carrefour.com.ar/aceite-de-girasol-carrefour-classic-pet-900-ml-757629/p', true, 'Aceite de girasol Carrefour Classic 900 ml.'),
  ('Agua', 'ml', 'Agua de red / Filtrada', 'ml', 1000, 1, 0, null, null, null, null, false, 'Sin fuente comercial: agua de red o filtrada.'),
  ('Almidón de maíz', 'g', 'Carrefour Classic / Maizena', 'g', 220, 1, 2400, 'Carrefour Online', 'carrefour_vtex', '719351', 'https://www.carrefour.com.ar/almidon-de-maiz-maizena-clasica-sin-tacc-220-g-719351/p', true, 'Almidón de maíz Maizena 220 g.'),
  ('Arándanos', 'g', 'El Mercado (Frescos)', 'g', 1000, 1, 5000, 'Carrefour Online', null, null, null, false, 'Producto fresco sin presentación estable de 1 kg.'),
  ('Azúcar', 'g', 'Ledesma Superior', 'kg', 1, 1000, 1639, 'Carrefour Online', 'carrefour_vtex', '596906', 'https://www.carrefour.com.ar/azucar-ledesma-molida-superior-bolsa-1-kg/p', true, 'Azúcar Ledesma Superior 1 kg.'),
  ('Azúcar impalpable', 'g', 'Talco Dewey', 'kg', 1, 1000, 4499.99, 'Cocina con Valentino', 'valentino_html', '5148', 'https://www.cocinaconvalentino.com.ar/azucar/5148-azucar-impalpable-talco-dewey-1-kg-7798104880200.html', true, 'Azúcar impalpable Talco Dewey 1 kg.'),
  ('Azúcar mascabo', 'g', 'Balaju', 'g', 500, 1, 2198.14, 'Carrefour Online', null, null, null, false, 'La marca Balaju de 500 g no tiene una ficha estable verificada.'),
  ('Bicarbonato de sodio', 'g', 'Carrefour Classic', 'g', 50, 1, 382.95, 'Carrefour Online', 'carrefour_vtex', '744457', 'https://www.carrefour.com.ar/bicarbonato-de-sodio-carrefour-classic-50-g-744457/p', true, 'Bicarbonato Carrefour Classic 50 g.'),
  ('Cacao amargo', 'g', 'Carrefour Classic', 'g', 800, 1, 4034.8, 'Carrefour Online', 'carrefour_vtex', '721634', 'https://www.carrefour.com.ar/cacao-en-polvo-carrefour-classic-pouch-800-g-721634/p', true, 'Cacao en polvo Carrefour Classic 800 g.'),
  ('Café', 'g', 'Carrefour Classic', 'g', 170, 1, 6357.99, 'Carrefour Online', 'carrefour_vtex', '745140', 'https://www.carrefour.com.ar/cafe-instantaneo-clasico-carrefour-classic-en-frasco-170-g-745140/p', true, 'Café instantáneo Carrefour Classic 170 g.'),
  ('Canela', 'g', 'Carrefour Classic', 'g', 25, 1, 498.67, 'Carrefour Online', 'carrefour_vtex', '742726', 'https://www.carrefour.com.ar/canela-molida-carrefour-classic-en-sobre-25-g-742726/p', true, 'Canela molida Carrefour Classic 25 g.'),
  ('Chocolate Aguila', 'g', 'Águila 60%', 'g', 130, 1, 3800, 'Carrefour Online', 'carrefour_vtex', '779018', 'https://www.carrefour.com.ar/tableta-de-chocolate-amargo-60-cacao-aguila-130-grs-779018/p', true, 'Se fijó la variedad Águila 60% de 130 g para evitar coincidencias ambiguas.'),
  ('Chocolate blanco', 'g', 'Carrefour Classic', 'g', 30, 1, 605.92, 'Carrefour Online', 'carrefour_vtex', '663431', 'https://www.carrefour.com.ar/tableta-de-chocolate-carrefour-classic-blanco-30-grs-663431/p', true, 'Chocolate blanco Carrefour Classic 30 g.'),
  ('Claras de huevo', 'g', null, 'g', 330, 1, 2350, 'Carrefour Online', null, null, null, false, 'No se encontró una presentación comercial equivalente y estable.'),
  ('Colorante rosa', 'g', 'Fleibor', 'g', 5, 1, 2500, 'Cotillón / Repostería', null, null, null, false, 'Compra genérica de cotillón sin URL de producto.'),
  ('Crema para batir', 'ml', 'Carrefour Classic', 'ml', 200, 1, 2231.12, 'Carrefour Online', 'carrefour_vtex', '745030', 'https://www.carrefour.com.ar/crema-de-leche-para-batir-carrefour-classic-uat-200-cc-745030/p', true, 'Crema para batir Carrefour Classic 200 cc.'),
  ('Dulce de leche repostero', 'g', 'Carrefour Classic', 'g', 400, 1, 1545.34, 'Carrefour Online', 'carrefour_vtex', '721487', 'https://www.carrefour.com.ar/dulce-de-leche-repostero-carrefour-classic-en-pote-400-g-721487/p', true, 'Dulce de leche repostero Carrefour Classic 400 g.'),
  ('Duraznos en almíbar', 'g', 'Carrefour Classic', 'g', 820, 1, 1515.02, 'Carrefour Online', 'carrefour_vtex', '590818', 'https://www.carrefour.com.ar/duraznos-amarillos-en-mitades-carrefour-classic-820-g-31272/p', true, 'Duraznos Carrefour Classic 820 g.'),
  ('Esencia de vainilla', 'ml', 'Yuspe', 'ml', 110, 1, 1839, 'Carrefour Online', 'carrefour_vtex', '226701', 'https://www.carrefour.com.ar/esencia-de-vainilla-yuspe-pet-110-cc/p', true, 'Esencia de vainilla Yuspe 110 cc.'),
  ('Frutillas', 'g', 'El Mercado (Frescas)', 'g', 1000, 1, 5000, 'Carrefour Online', null, null, null, false, 'Producto fresco estacional sin ficha estable de 1 kg.'),
  ('Galletitas de vainilla', 'g', 'Carrefour Classic', 'g', 360, 1, 2514.2, 'Carrefour Online', 'carrefour_vtex', '473990', 'https://www.carrefour.com.ar/galletitas-carrefour-classic-vainilla-3-x-120-g/p', true, 'Galletitas de vainilla Carrefour Classic 3 x 120 g.'),
  ('Gelatina sin sabor', 'g', 'Carrefour Classic', 'g', 14, 1, 470.17, 'Carrefour Online', 'carrefour_vtex', '754009', 'https://www.carrefour.com.ar/gelatina-sin-sabor-carrefour-classic-14-grs-754009/p', true, 'Gelatina sin sabor Carrefour Classic 14 g.'),
  ('Harina 0000', 'g', 'Pureza 0000', 'kg', 1, 1000, 1249, 'Carrefour Online', 'carrefour_vtex', '551284', 'https://www.carrefour.com.ar/harina-de-trigo-pureza-0000-1-kg-551284/p', true, 'Harina Pureza 0000 1 kg.'),
  ('Huevos', 'unit', 'La Piara blancos', 'unit', 6, 1, 2300, 'Carrefour Online', null, null, null, false, 'La marca La Piara de 6 unidades no tiene una ficha estable verificada.'),
  ('Jugo de lima', 'g', 'Frescas', 'g', 1000, 1, 4000, 'Carrefour Online', null, null, null, false, 'Insumo derivado de fruta fresca sin presentación comercial equivalente.'),
  ('Jugo de limón', 'unit', 'Frescos', 'unit', 6, 1, 0, 'Carrefour Online', null, null, null, false, 'Insumo derivado de fruta fresca sin presentación comercial equivalente.'),
  ('Leche', 'ml', 'La Serenísima Clásica 3%', 'l', 1, 1000, 2140, 'Carrefour Online', 'carrefour_vtex', '720719', 'https://www.carrefour.com.ar/leche-la-serenisima-clasica-3-1l-720719/p', true, 'Leche La Serenísima Clásica 3% 1 litro.'),
  ('Leche condensada', 'g', 'Carrefour', 'g', 395, 1, 5312.94, 'Carrefour Online', 'carrefour_vtex', '695427', 'https://www.carrefour.com.ar/leche-condensada-carrefour-tetra-395-g-695427-695427/p', true, 'Leche condensada Carrefour 395 g.'),
  ('Leche en polvo', 'g', 'Carrefour Classic', 'g', 400, 1, 2521.4, 'Carrefour Online', 'carrefour_vtex', '735950', 'https://www.carrefour.com.ar/leche-en-polvo-entera-carrefour-classic-pouch-400-g-735950/p', true, 'Leche en polvo entera Carrefour Classic 400 g.'),
  ('Manteca', 'g', 'La Tonadita', 'g', 200, 1, 4499, 'Carrefour Online', 'carrefour_vtex', '482414', 'https://www.carrefour.com.ar/manteca-tonadita-calidad-extra-200-g/p', true, 'Manteca Tonadita calidad extra 200 g.'),
  ('Nueces', 'g', 'El Mercado (Peladas)', 'g', 300, 1, 7671.4, 'Carrefour Online', 'carrefour_vtex', '691827', 'https://www.carrefour.com.ar/nueces-pelados-el-mercado-300-grs-691827/p', true, 'Nueces peladas El Mercado 300 g.'),
  ('Nuez moscada', 'g', 'Carrefour Extra', 'g', 60, 1, 3267.35, 'Carrefour Online', 'carrefour_vtex', '774348', 'https://www.carrefour.com.ar/molinillo-nuez-moscada-carrefour-extra-60-grs-774348/p', true, 'Nuez moscada Carrefour Extra 60 g.'),
  ('Papel de arroz', 'unit', 'Genérica / Repostería', 'unit', 1, 1, 2524.35, 'Cotillón / Repostería', null, null, null, false, 'Compra genérica de cotillón sin URL de producto.'),
  ('Polvo de hornear', 'g', 'Carrefour Classic', 'g', 50, 1, 1296.38, 'Carrefour Online', 'carrefour_vtex', '744459', 'https://www.carrefour.com.ar/polvo-para-hornear-carrefour-classic-50-grs-744459/p', true, 'Polvo para hornear Carrefour Classic 50 g.'),
  ('Queso crema', 'g', 'Carrefour Classic', 'g', 290, 1, 2677.34, 'Carrefour Online', 'carrefour_vtex', '719066', 'https://www.carrefour.com.ar/queso-crema-carrefour-classic-tradicional-290-g-719066/p', true, 'Queso crema Carrefour Classic tradicional 290 g.'),
  ('Queso mascarpone', 'g', 'Carrefour Classic', 'g', 250, 1, 1985.15, 'Carrefour Online', 'carrefour_vtex', '753058', 'https://www.carrefour.com.ar/queso-mascarpone-carrefour-classic-en-pote-250-grs-753058/p', true, 'Queso mascarpone Carrefour Classic 250 g.'),
  ('Ralladura de lima', 'unit', 'Frescas', 'unit', 1, 1, 0, null, null, null, null, false, 'Cantidad necesaria; se valora con la fruta comprada.'),
  ('Ralladura de limón', 'unit', 'Frescos', 'unit', 6, 1, 0, null, null, null, null, false, 'Cantidad necesaria; se valora con la fruta comprada.'),
  ('Ricota', 'g', 'La Choza', 'g', 500, 1, 9750, 'Carrefour Online', null, null, null, false, 'La marca La Choza de 500 g no tiene una ficha estable verificada.'),
  ('Sal fina', 'g', 'Carrefour Classic', 'g', 500, 1, 1187.32, 'Carrefour Online', 'carrefour_vtex', '575040', 'https://www.carrefour.com.ar/sal-fina-carrefour-classic-en-bolsa-500-grs-575040/p', true, 'Sal fina Carrefour Classic en bolsa 500 g.'),
  ('Yemas', 'g', null, 'g', 120, 1, 2350, 'Carrefour Online', null, null, null, false, 'No se encontró una presentación comercial equivalente y estable.');

insert into public.ingredients (
  name, base_unit, supply_type, source_type, source_product_id, source_url,
  auto_update_enabled, source_notes
)
select
  name, base_unit, 'ingredient', source_type, source_product_id, source_url,
  auto_update_enabled, source_notes
from reference_supplies
on conflict (name) do update set
  source_type = excluded.source_type,
  source_product_id = excluded.source_product_id,
  source_url = excluded.source_url,
  auto_update_enabled = excluded.auto_update_enabled,
  source_notes = excluded.source_notes,
  updated_at = now();

-- Solo agrega el precio de referencia si el insumo todavía no tiene historial.
-- Así no pisa precios que la administradora ya haya cargado manualmente.
insert into public.ingredient_prices (
  ingredient_id, package_quantity, package_price, supplier, recorded_at,
  brand, purchase_unit, conversion_to_base
)
select
  i.id, r.package_quantity, r.package_price, r.supplier, current_date,
  r.brand, r.purchase_unit, r.conversion_to_base
from reference_supplies r
join public.ingredients i on i.name = r.name
where not exists (
  select 1 from public.ingredient_prices ip where ip.ingredient_id = i.id
);

-- Agrega al final de la vista la información de sincronización sin cambiar
-- las columnas que ya consume el panel administrativo.
create or replace view public.current_ingredient_costs
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.base_unit,
  i.supply_type,
  i.size_label,
  latest.package_quantity,
  latest.package_price,
  latest.supplier,
  latest.recorded_at,
  case
    when previous.package_quantity is null or previous.package_price = 0 then null
    else round(
      (
        (latest.package_price / (latest.package_quantity * latest.conversion_to_base))
        / (previous.package_price / (previous.package_quantity * previous.conversion_to_base)) - 1
      ) * 100,
      2
    )
  end as price_change_percent,
  case
    when latest.package_quantity is null then null
    else round(
      latest.package_price / (latest.package_quantity * latest.conversion_to_base),
      4
    )
  end as effective_unit_cost,
  latest.brand,
  latest.purchase_unit,
  latest.conversion_to_base,
  i.source_type,
  i.source_product_id,
  i.source_url,
  i.auto_update_enabled,
  i.source_notes,
  i.last_price_sync_at,
  i.last_price_sync_status,
  i.last_price_sync_message
from public.ingredients i
left join lateral (
  select
    ip.package_quantity,
    ip.package_price,
    ip.supplier,
    ip.recorded_at,
    ip.brand,
    ip.purchase_unit,
    ip.conversion_to_base
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  limit 1
) latest on true
left join lateral (
  select ip.package_quantity, ip.package_price, ip.conversion_to_base
  from public.ingredient_prices ip
  where ip.ingredient_id = i.id
  order by ip.recorded_at desc, ip.created_at desc
  offset 1
  limit 1
) previous on true;

grant select on public.current_ingredient_costs to authenticated;
