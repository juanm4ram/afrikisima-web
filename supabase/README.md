# Configuración de Supabase

1. Crear un proyecto en Supabase.
2. Abrir SQL Editor y ejecutar las migraciones en este orden:

       202609070001_initial_pricing.sql
       202609070002_custom_budgets.sql
       202609070003_ingredient_brand.sql
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
receta en bizcocho, relleno, cobertura u otras secciones; registrar molde,
presentación, extras, mano de obra y precio ofrecido; y recalcular los costos
cuando cambia el precio de un ingrediente.

Mientras las variables no estén configuradas, o si Supabase falla, la tienda
continúa usando el catálogo local.

Netlify ejecuta además un control real de la base cada ocho horas mediante
netlify/functions/supabase-health.mts. El control consulta la cantidad de
variantes publicadas y falla de forma visible en los logs si Supabase no responde.

## Seguridad

La publishable key puede estar en el navegador; las políticas RLS limitan lo que
puede hacer. No usar una secret key ni service_role en variables NEXT_PUBLIC.
