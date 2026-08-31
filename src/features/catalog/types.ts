/** Tipos del catálogo. */

export type SizeId = "mediano" | "grande";

export interface ProductSize {
  id: SizeId;
  label: string;
  /** Descripción corta: diámetro y porciones aproximadas. */
  detail: string;
  price: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  gallery?: string[];
  tags?: string[];
  sizes: ProductSize[];
}

export interface Category {
  id: string;
  name: string;
}
