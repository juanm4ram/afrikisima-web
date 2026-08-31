/**
 * Catálogo de Afrikísima.
 *
 * Fuente de datos que sirve `/api/catalog`. Precios y tamaños son ficticios:
 * editar este archivo para actualizar la carta.
 */

import type { Category, Product, ProductSize } from "../types";

/** El orden de este array es el orden en la página y en el menú. */
export const categories: Category[] = [
  { id: "personalizadas", name: "Tortas Personalizadas" },
  { id: "clasicas", name: "Tortas Clásicas" },
  { id: "tartas", name: "Tartas" },
  { id: "cookies", name: "Cookies" },
];

const cakeSizes = (mediano: number, grande: number): ProductSize[] => [
  {
    id: "mediano",
    label: "Mediana",
    detail: "18 cm · 10 a 12 porciones",
    price: mediano,
  },
  {
    id: "grande",
    label: "Grande",
    detail: "24 cm · 18 a 20 porciones",
    price: grande,
  },
];

export const products: Product[] = [
  {
    id: "personalizada",
    slug: "torta-personalizada",
    name: "Torta Personalizada",
    description:
      "Diseño a medida: temática, colores y mensaje. Nos escribís la idea y la cotizamos juntos.",
    categoryId: "personalizadas",
    image: "/products/personalizada.webp",
    gallery: ["/products/personalizada.webp", "/products/personalizada-2.webp"],
    tags: ["A pedido"],
    sizes: cakeSizes(45000, 68000),
  },
  {
    id: "sorpresa",
    slug: "torta-sorpresa",
    name: "Torta Sorpresa",
    description:
      "Lleva una lámina de papel de arroz comestible sobre la cobertura: se quema la imagen de encima y debajo aparece la sorpresa escondida. Bizcochos y rellenos a elección.",
    categoryId: "personalizadas",
    image: "/products/sorpresa.webp",
    gallery: ["/products/sorpresa.webp", "/products/sorpresa-2.webp"],
    tags: ["Novedad"],
    sizes: cakeSizes(45000, 68000),
  },
  {
    id: "glitter",
    slug: "glitter-cake",
    name: "Glitter Cake",
    description:
      "Bizcochos y rellenos a elección. Ejemplo: bizcochos de vainilla con relleno de duraznos con crema.",
    categoryId: "personalizadas",
    image: "/products/glitter-cake.webp",
    gallery: ["/products/glitter-cake.webp", "/products/glitter-cake-2.webp"],
    tags: ["Personalizable"],
    sizes: cakeSizes(42000, 62000),
  },
  {
    id: "vintage",
    slug: "torta-vintage",
    name: "Torta Vintage",
    description:
      "Bizcocho y rellenos a elección. Ejemplo: bizcocho de caramelo y relleno de ganache de caramelo.",
    categoryId: "personalizadas",
    image: "/products/vintage.webp",
    sizes: cakeSizes(38000, 58000),
  },
  {
    id: "chaja",
    slug: "torta-chaja",
    name: "Torta Chajá",
    description:
      "Bizcochuelo húmedo, crema chantilly, duraznos en almíbar y merengue seco.",
    categoryId: "clasicas",
    image: "/products/chaja.webp",
    gallery: ["/products/chaja.webp", "/products/chaja-2.webp"],
    tags: ["Más vendida"],
    sizes: cakeSizes(34000, 52000),
  },
  {
    id: "tiramisu",
    slug: "tiramisu",
    name: "Tiramisú",
    description:
      "Capas de bizcocho embebido en café, crema de mascarpone y cacao amargo espolvoreado.",
    categoryId: "clasicas",
    image: "/products/tiramisu.webp",
    gallery: ["/products/tiramisu.webp", "/products/tiramisu-2.webp"],
    sizes: cakeSizes(33000, 50000),
  },
  {
    id: "carrot-cake",
    slug: "carrot-cake",
    name: "Carrot Cake",
    description: "Bizcocho de zanahoria con frosting de queso crema.",
    categoryId: "clasicas",
    image: "/products/carrot-cake.webp",
    sizes: cakeSizes(30000, 46000),
  },
  {
    id: "ricota",
    slug: "torta-de-ricota",
    name: "Torta de Ricota",
    description: "Clásica torta de ricota con limón.",
    categoryId: "clasicas",
    image: "/products/ricota.webp",
    gallery: ["/products/ricota.webp", "/products/ricota-2.webp"],
    sizes: cakeSizes(28000, 42000),
  },
  {
    id: "cheesecake-ny",
    slug: "cheesecake-new-york",
    name: "Cheesecake New York",
    description:
      "Base de galleta con manteca, relleno cremoso de queso horneado y cobertura de frutos rojos.",
    categoryId: "tartas",
    image: "/products/cheesecake-ny.webp",
    sizes: cakeSizes(32000, 48000),
  },
  {
    id: "lemon-pie",
    slug: "lemon-pie",
    name: "Lemon Pie",
    description:
      "Masa sablée, crema de limón bien cítrico y merengue italiano flameado a mano.",
    categoryId: "tartas",
    image: "/products/lemon-pie-2.webp",
    gallery: ["/products/lemon-pie-2.webp", "/products/lemon-pie.webp"],
    sizes: cakeSizes(29000, 44000),
  },
  {
    id: "frutilla",
    slug: "tarta-de-frutilla",
    name: "Tarta de Frutilla",
    description:
      "Masa dulce, crema pastelera de vainilla y frutillas frescas. Sujeta a temporada.",
    categoryId: "tartas",
    image: "/products/frutilla.webp",
    tags: ["De temporada"],
    sizes: cakeSizes(35000, 54000),
  },
  {
    id: "cookies",
    slug: "cookies",
    name: "Cookies con Chocolate",
    description:
      "Cookies de azúcar mascabo con chocolate semiamargo. Crocantes por fuera, tiernas adentro.",
    categoryId: "cookies",
    image: "/products/cookies.webp",
    tags: ["Listas para llevar"],
    sizes: [
      { id: "mediano", label: "Caja x6", detail: "6 unidades", price: 12000 },
      { id: "grande", label: "Caja x12", detail: "12 unidades", price: 22000 },
    ],
  },
];

export function getCatalog() {
  return {
    categories: categories.map((category) => ({
      ...category,
      products: products.filter((product) => product.categoryId === category.id),
    })),
    products,
  };
}

export function findProduct(id: string) {
  return products.find((product) => product.id === id) ?? null;
}
