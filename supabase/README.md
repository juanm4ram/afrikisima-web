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
