<div align="center">
  <img src="docs/logo.png" alt="Afrikísima" width="380">

  <p><strong>Storefront for Afrikísima, an artisan bakery</strong><br>
  Cake catalogue with size selection and WhatsApp checkout.</p>

  <p>
    <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs&logoColor=white">
    <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
    <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white">
    <img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-A4294C">
  </p>

  <p><a href="README.md">Español</a> · <strong>English</strong></p>
</div>

---

Website for an artisan bakery in Tres de Febrero, Buenos Aires. The landing page
has no marketing copy: it drops you straight into the catalogue. Customers pick a
product and a size, build their order and confirm it over WhatsApp with the
message already written for them.

There is no payment gateway and no database — orders are arranged over WhatsApp,
so the whole site runs on the free tier of any Next.js host.

## Screenshots

|  |  |
| :--: | :--: |
| ![Landing](docs/screenshots/home.jpg) | ![Catalogue](docs/screenshots/catalogo.jpg) |
| **Landing** — logo over the photo, catalogue right below | **Catalogue** — per-category carousel on desktop |
| ![Product sheet](docs/screenshots/producto.jpg) | ![Cart](docs/screenshots/carrito.jpg) |
| **Product** — gallery, sizes and notes | **Order** — details, delivery date and terms |

<div align="center">
  <img src="docs/screenshots/mobile-home.jpg" alt="Landing on mobile" width="270">
  &nbsp;&nbsp;
  <img src="docs/screenshots/mobile-catalogo.jpg" alt="Catalogue on mobile" width="270">
  <p><em>On mobile the carousel is replaced by a vertical grid.</em></p>
</div>

## Features

- **Catalogue by category** with filters, defined in a single data file.
- **Infinite carousel** on desktop, with arrows and no visible seam when it wraps
  around. On mobile it falls back to a vertical grid — no carousel where it hurts.
- **Product sheet** with gallery, size selection, quantity and free-text notes.
- **Persistent cart** in the browser (`localStorage`), with customer details,
  fulfilment method and date.
- **WhatsApp checkout**: the server validates the order and recalculates prices
  against the catalogue before composing the message.
- **Delivery date** with a 3-day minimum and the shop's terms shown up front.
- Pastel theme derived from the brand colour, and self-hosted fonts — the build
  does not depend on Google Fonts.

## Stack

| | |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Fonts | Playfair Display + Jost, via `@fontsource` (self-hosted) |
| State | React Context + `localStorage` |

## Running it

Requires Node.js 20 or newer.

```bash
git clone https://github.com/juanm4ram/afrikisima-web.git
cd afrikisima-web
npm install
cp .env.example .env.local   # fill in the contact details
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## Configuration

Contact details are **not in the source**: they come from environment variables,
so the public repository does not expose the shop's phone number or email.

| Variable | Required | What it does |
| --- | :--: | --- |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | yes | Number that receives orders, international format without `+` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | yes | Contact email in the footer |
| `NEXT_PUBLIC_INSTAGRAM` | no | Instagram handle |
| `NEXT_PUBLIC_TIKTOK` | no | TikTok handle |
| `NEXT_PUBLIC_SITE_URL` | no | Public URL, used for the link preview image |

> Without the two required ones the site **still runs**, using placeholder data
> and printing a warning in the development console. Set them on your host before
> going live, or orders will not reach anyone.

> **Catalogue prices are placeholders** — the final ones are still pending.

## Project structure

```
src/
├─ app/                       routes only (App Router)
│  ├─ api/catalog/route.ts    GET  — the menu
│  ├─ api/orders/route.ts     POST — validates and totals the order
│  ├─ layout.tsx
│  └─ page.tsx
│
├─ features/                  each feature owns its components and its data
│  ├─ catalog/
│  │  ├─ components/          catalog-section · product-card · product-carousel · product-dialog
│  │  ├─ data/products.ts     ← THE MENU
│  │  ├─ types.ts
│  │  └─ index.ts             the feature's public API
│  └─ cart/
│     ├─ components/cart-sheet.tsx
│     ├─ cart-provider.tsx    cart state
│     └─ index.ts
│
├─ components/
│  ├─ layout/                 header · hero · footer · WhatsApp button
│  └─ ui/                     shadcn/ui primitives
│
├─ lib/
│  ├─ config/shop.ts          business details and delivery terms
│  ├─ config/storefront.ts    external storefront (optional)
│  ├─ format.ts               price formatting
│  └─ utils.ts
│
└─ styles/globals.css         pastel theme (colour and typography tokens)

public/                       static files served by the site
├─ brand/ · backgrounds/ · products/

assets/                       source material, NOT served (see assets/README.md)
└─ brand/ · photos/           original camera photos — kept out of git
```

Conventions:

- **Organised by feature, not by file type.** Everything catalogue-related lives
  in `features/catalog`, everything cart-related in `features/cart`. Each exposes
  an `index.ts` and the rest of the app imports only from there.
- `app/` holds **routes only**. No UI components live there.
- `components/ui` are primitives with no business logic; `components/layout` are
  the pieces of the page shell.
- Absolute imports through the `@/` alias.

## Editing the menu

Everything lives in **`src/features/catalog/data/products.ts`**:

- `categories` — the sections in the filter bar. **Array order is the order on
  the page and in the nav.**
- `products` — name, description, photo, category and sizes for each product.
- `cakeSizes(medium, large)` — helper for the two standard sizes.

To add a product: drop the photo into `public/products/` (square `.webp`, around
1400 px) and add the entry. [`assets/README.md`](assets/README.md) has the command
to convert a phone photo into the right format.

Business details (delivery terms, lead time) live in
**`src/lib/config/shop.ts`**.

## How ordering works

```
Catalogue → Product sheet (size + qty) → Cart (localStorage)
                                              │
                                              ▼
                                POST /api/orders   ← re-prices against
                                              │      the catalogue
                                              ▼
                          WhatsApp with the message ready to send
```

The important part is the server step: **prices are never taken from the client**.
`POST /api/orders` receives only `productId`, `sizeId` and `quantity`, looks each
product up in the catalogue and builds the total server-side, so a cart tampered
with in the browser cannot change what gets quoted.

`GET /api/catalog` serves the menu. It keeps the starter's pattern: if external
storefront credentials are configured it queries that backend and falls back to
the local catalogue only on failure.

## Deployment

Any host with Next.js support. Connect the repository — no build configuration
needed, it is detected automatically. Set the contact environment variables and,
if you want link previews, `NEXT_PUBLIC_SITE_URL`.

No database and no payment gateway required.

## Roadmap

- [x] Catalogue, cart and WhatsApp checkout
- [x] Responsive design
- [ ] Final prices
- [ ] Admin panel (the menu is currently edited in code)
- [ ] Online payments

## Licence and credits

The **code** is MIT licensed — see [LICENSE](LICENSE).

It started from [`craveup/restaurant-storefront-starter`](https://github.com/craveup/restaurant-storefront-starter),
also MIT, from which it keeps the shadcn/ui primitives and the backend pattern
with a local fallback.

> **Images and branding are not covered by the MIT licence.** The Afrikísima logo
> and the product photographs belong to the bakery and are included only so the
> project looks complete. If you reuse this code, replace the contents of
> `public/brand/` and `public/products/`.
