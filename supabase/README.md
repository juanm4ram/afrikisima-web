# Configuración de Supabase

1. Crear un proyecto en Supabase.
2. Abrir SQL Editor y ejecutar las migraciones en este orden:

       202609070001_initial_pricing.sql
       202609070002_custom_budgets.sql
       202609070003_ingredient_brand.sql
       202609110004_recipe_item_waste.sql
       202609110005_servings_purchase_units.sql
       202609110006_supplies.sql
       202609300007_reference_supplies_and_price_sources.sql
       202610010008_catalog_recipes_and_detailed_costs.sql
       202610100009_supply_corrections_and_packaging.sql
       202610100010_complete_published_recipe_costs.sql
       202610100011_custom_final_prices.sql
       202610100012_shared_packaging_by_size.sql
       202610100013_lemon_unit_for_juice.sql
       202610240014_recipe_library_sizes_and_prices.sql
       202611060015_tiramisu_small_and_admin_library.sql
3. En Authentication > Users, crear el usuario de la administradora.
4. Ejecutar en SQL Editor, reemplazando el correo:

       insert into public.app_admins (user_id)
       select id from auth.users
       where lower(email) = lower('correo@ejemplo.com')
       on conflict (user_id) do nothing;

5. Copiar Project URL y Publishable key a .env.local:

       NEXT_PUBLIC_SUPABASE_URL=https://proyecto.supabase.co
       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

6. Agregar las mismas variables en Netlify y volver a desplegar.
7. Entrar en /admin/login.

El panel de presupuestos está en /admin/presupuestos. Permite separar cada
receta en bizcocho, relleno, cobertura, packaging u otras secciones; registrar
molde, presentación y precio ofrecido; y recalcular los costos cuando cambia el
precio de un insumo.

Los paneles administrativos permiten descargar un Excel completo o archivos CSV
separados de recetas e insumos. El Excel incluye las hojas Tortas, Detalle de
recetas, Insumos e Historial de precios. Las rutas de exportación exigen una
sesión incluida en `app_admins`.

La migración `202610010008_catalog_recipes_and_detailed_costs.sql` crea una ficha
editable para cada variante publicada y precarga las recetas respaldadas por las
planillas proporcionadas. Las cantidades se guardan en `recipe_items`, pero cada
costo se obtiene siempre del último registro de `ingredient_prices`. Si falta el
precio de un insumo, el panel no calcula ni permite publicar un precio sugerido
incompleto.

La migración `202610100009_supply_corrections_and_packaging.sql` actualiza los
proveedores y precios corregidos, separa arándanos frescos y congelados, usa el
congelado como opción predeterminada y agrega caja más base/tablita a las recetas
que tienen esos importes en las planillas. Cuando una receta publicada no tiene
un packaging respaldado por los archivos, agrega una fila “Packaging pendiente”
sin precio: queda visible para completar y bloquea un sugerido incompleto.

La migración `202610100010_complete_published_recipe_costs.sql` reemplaza esos
placeholders en Chajá, Carrot Cake, Cheesecake New York, Tarta de Frutilla y
Cookies. Precarga recetas base editables, agrega sus packaging por tamaño,
incorpora Zanahoria con fuente automática de Carrefour y completa el precio del
Colorante negro. Las tortas de 18 cm se escalan desde la referencia de 24 cm y
Cookies se calcula por caja x6 o x12.

La migración `202610100011_custom_final_prices.sql` agrega una segunda forma de
definir el precio final. El administrador puede indicar una ganancia porcentual
sobre el costo o un importe fijo en pesos. El panel muestra el precio sugerido y
el personalizado por separado, y permite elegir cuál publicar en la tienda.

La migración `202610100012_shared_packaging_by_size.sql` reemplaza el packaging
duplicado por producto por dos insumos compartidos: caja de 24 cm ($2.000) y
tablita de 22 cm ($4.000), ambas del Cotillón de Coronado. Cada receta de
torta/tarta utiliza una unidad de cada una; al actualizar el precio del insumo,
el cambio se refleja en todas las recetas que lo usan.

La migración `202610100013_lemon_unit_for_juice.sql` unifica Jugo de lima, Jugo
de limón y Lima en un único insumo `Limón`, comprado por unidad en Verdulería
Tiziana. Usa como conversión inicial 200 ml de jugo = 6 limones y registra el
precio informado de $4.400 por 6 unidades. Jugo y ralladura no se cobran como
compras independientes de la fruta.

La migración `202610240014_recipe_library_sizes_and_prices.sql` corrige los
tamaños reales (tortas medianas de 20 cm, tartas y tiramisú medianos de 22 cm),
iguala las cantidades de las tartas y del tiramisú entre 22 y 24 cm, y asigna
el packaging correcto por tamaño. También crea una biblioteca normalizada de
bizcochos, rellenos y coberturas para 1 y 2 pisos, incluida la referencia chica,
sin publicar tamaños que todavía no tienen precio de venta. Las cantidades
explícitas prevalecen cuando el texto de la proporción es contradictorio.

Los nuevos insumos con precio son crema Milkaut de 330 ml y 200 ml, chocolate
con leche y Oreo de 118 g. La caja de 30 cm queda registrada a $2.700. La
tablita de 30 cm y la caja/tablita de 25 cm quedan visibles sin precio hasta que
se informe el costo del Cotillón de Coronado; por eso bloquean el sugerido de
las tortas afectadas en lugar de usar un importe inventado.

La migración `202611060015_tiramisu_small_and_admin_library.sql` aplica el
relevamiento del 2026-11-06. Lo que ya estaba en la 14 (bizcochos, rellenos,
coberturas, caja de 30 cm a $2.700 y packaging de 25 cm para medianas) no se
repite. Agrega el tamaño chico de Tiramisú, la única excepción con chica: su
receta es la mitad de la grande y queda oculta en la tienda hasta que se le
asigne precio y packaging desde el panel. La fuente también dice “de mediana a
chica, 1/3 menos”, pero como la mediana usa la misma cantidad que la grande
ambas reglas no pueden cumplirse; se aplica la mitad y queda anotado. Si
existiera una tarta chica, la oculta. Crea además la vista
`recipe_template_items_admin`, que usa la pestaña “Biblioteca de recetas”.

El panel `/admin` está dividido en tres pestañas: Productos (tarjetas por
producto con foto, estado de cada tamaño, filtros y botón para mostrar u
ocultar un tamaño en la tienda), Insumos (búsqueda y filtros por tipo, sin
precio o error de sincronización) y Biblioteca de recetas (cada preparación
comparada por tamaño y pisos, con su costo actual y las reglas de escalado).

Para revisar el costo vigente de cada receta reutilizable:

       select *
       from public.recipe_template_costs
       order by component_type, sort_order, name, size_code;

Después de ejecutarla, esta consulta permite auditar ingredientes, packaging y
precios faltantes:

       select *
       from public.recipe_cost_completeness
       order by is_complete, variant_id;

Para ver el motivo concreto de cualquier bloqueo que todavía exista:

       select *
       from public.published_recipe_price_blockers
       where status <> 'Completa'
       order by product_name, variant_label;

Mientras las variables no estén configuradas, o si Supabase falla, la tienda
continúa usando el catálogo local.

Netlify ejecuta además un control real de la base cada ocho horas mediante
netlify/functions/supabase-health.mts. El control consulta la cantidad de
variantes publicadas y falla de forma visible en los logs si Supabase no responde.

## Actualización automática de precios

La migración `202609300007_reference_supplies_and_price_sources.sql` precarga los
41 insumos del archivo de referencia sin pisar el historial de los que ya
existían. Los productos que tienen una ficha exacta y estable quedan vinculados
a Carrefour o Cocina con Valentino; los frescos, derivados y compras genéricas
quedan identificados como actualización manual para evitar coincidencias
incorrectas.

Netlify ejecuta `netlify/functions/sync-supply-prices.mts` todos los días a las
07:15 de Argentina. La función usa el precio de lista regular, no una promoción
transitoria, y solo agrega una fila al historial cuando el precio cambió.

Agregar en Netlify, además de las variables públicas:

       SUPABASE_SERVICE_ROLE_KEY=...

La clave se obtiene en Supabase > Project Settings > API Keys. Debe configurarse
solo como variable secreta de servidor y nunca con el prefijo `NEXT_PUBLIC_`.

## Seguridad

La publishable key puede estar en el navegador; las políticas RLS limitan lo que
puede hacer. La clave `service_role` se usa exclusivamente en la función
programada de Netlify. No usarla en variables `NEXT_PUBLIC_` ni exponerla al
navegador.
