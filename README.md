# Afrikísima — tienda web

Storefront de la pastelería **Afrikísima**: el catálogo se muestra directo en la
portada (arriba solo el logo sobre una imagen de fondo), el cliente elige tamaño,
arma el pedido y lo confirma por WhatsApp.

Stack: **Next.js 15** (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui.

---

## Correrlo local

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev        # http://localhost:3000
```

Otros comandos:

```bash
npm run build      # build de producción
npm start          # servir el build
npm run lint       # ESLint
npm run typecheck  # TypeScript sin emitir
```

---

## Configuración

Copiar `.env.example` a `.env.local`. **Nada es obligatorio** para que la web
funcione: sin variables usa los valores por defecto y el catálogo local.

| Variable | Para qué sirve |
| --- | --- |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número que recibe los pedidos. Formato internacional sin `+` (ej. `5492915551234`). |
| `NEXT_PUBLIC_INSTAGRAM` | Usuario de Instagram del pie de página. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Mail de contacto. |
| `NEXT_PUBLIC_SITE_URL` | URL pública, para la preview al compartir el link. |

> ⚠️ Antes de publicar, cambiar `NEXT_PUBLIC_WHATSAPP_NUMBER`: el valor por
> defecto es un número de ejemplo. **Los precios también son ficticios.**

---

## Estructura

```
src/
├─ app/                       solo rutas (App Router)
│  ├─ api/catalog/route.ts    GET  — la carta
│  ├─ api/orders/route.ts     POST — valida y totaliza el pedido
│  ├─ layout.tsx
│  └─ page.tsx
│
├─ features/                  cada feature con sus componentes y sus datos
│  ├─ catalog/
│  │  ├─ components/          catalog-section · product-card · product-dialog
│  │  ├─ data/products.ts     ← LA CARTA
│  │  ├─ types.ts
│  │  └─ index.ts             API pública de la feature
│  └─ cart/
│     ├─ components/cart-sheet.tsx
│     ├─ cart-provider.tsx    estado del carrito (localStorage)
│     └─ index.ts
│
├─ components/
│  ├─ layout/                 header · hero · footer · fab · error-boundary
│  └─ ui/                     primitivas de shadcn/ui
│
├─ lib/
│  ├─ config/shop.ts          datos del negocio (WhatsApp, horarios, dirección)
│  ├─ config/storefront.ts    config del storefront externo (opcional)
│  ├─ format.ts               formato de precios
│  └─ utils.ts                helper `cn`
│
└─ styles/globals.css         tema pastel (tokens de color, tipografías)

public/                        estáticos que sirve la web
├─ brand/                     logo.svg · logo.png · logo-white.png
├─ backgrounds/hero.webp      imagen de portada
└─ products/                  fotos de los productos (.webp optimizado)

assets/                        materiales fuente, NO se sirven (ver assets/README.md)
├─ brand/                     logo original y variantes
└─ photos/                    fotos originales de cámara (.heic) — fuera de git
```

Convenciones:

- **Por feature, no por tipo de archivo.** Todo lo del catálogo vive en
  `features/catalog`; todo lo del carrito, en `features/cart`. Cada una expone
  su `index.ts` y el resto de la app importa solo desde ahí.
- `app/` contiene **únicamente rutas**. Ningún componente de UI vive ahí.
- `components/ui` son primitivas sin lógica de negocio; `components/layout`, las
  piezas del armazón de la página.
- Imports absolutos con el alias `@/` (configurado en `tsconfig.json`).

---

## Editar la carta

Todo en **`src/features/catalog/data/products.ts`**:

- `categories` — las secciones de la barra de filtros.
- `products` — nombre, descripción, foto, categoría y tamaños de cada producto.
- `cakeSizes(mediano, grande)` — helper para los dos tamaños estándar.

Para sumar un producto: copiar la foto en `public/products/` (idealmente `.webp`
cuadrada de ~1400 px) y agregar la entrada.

Los datos del negocio (horarios, dirección, días de anticipación) están en
**`src/lib/config/shop.ts`**.

---

## Cómo funciona el pedido

1. El cliente elige producto y tamaño → se agrega al carrito
   (`features/cart/cart-provider.tsx`, persistido en el navegador).
2. Completa nombre, teléfono, fecha y tipo de entrega.
3. Al confirmar, el navegador llama a **`POST /api/orders`**. El servidor
   **recalcula los precios contra el catálogo** — nunca confía en los que manda
   el cliente — y devuelve el pedido con su número.
4. Con esa respuesta se abre WhatsApp con el mensaje ya armado.

`GET /api/catalog` expone la carta. Si algún día se configuran
`NEXT_PUBLIC_CRAVEUP_API_KEY` + `NEXT_PUBLIC_LOCATION_ID`, consulta ese backend y
usa el catálogo local solo como fallback.

---

## Publicarlo gratis (Vercel)

1. Subir el proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com): *Add New → Project* → elegir el repo.
3. Vercel detecta Next.js solo. En *Environment Variables* cargar al menos
   `NEXT_PUBLIC_WHATSAPP_NUMBER`.
4. *Deploy*. Queda en `https://<proyecto>.vercel.app`, plan gratuito.

No hace falta base de datos ni pasarela de pago: los pedidos van por WhatsApp.

---

## Pendientes conocidos

- Precios y medidas son de referencia; falta cargar los reales.
- Sin panel de administración: la carta se edita en el código.
- Sin cobro online (se coordina por WhatsApp).

---

## Créditos

Partió de [`craveup/restaurant-storefront-starter`](https://github.com/craveup/restaurant-storefront-starter)
(MIT) — ver `LICENSE`. Del starter se conservan las primitivas de shadcn/ui y el
patrón de backend con fallback local; el resto es propio.
