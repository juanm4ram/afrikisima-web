"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Product, ProductSize } from "@/features/catalog/types";

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  image: string;
  sizeId: string;
  sizeLabel: string;
  sizeDetail: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (
    product: Product,
    size: ProductSize,
    quantity: number,
    notes?: string,
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  isHydrated: boolean;
}

const STORAGE_KEY = "afrikisima.cart.v1";

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      // carrito corrupto o storage bloqueado: arrancamos vacío
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // sin persistencia disponible, seguimos en memoria
    }
  }, [lines, isHydrated]);

  const addLine = useCallback(
    (
      product: Product,
      size: ProductSize,
      quantity: number,
      notes?: string,
    ) => {
      const trimmedNotes = notes?.trim() ?? "";
      const key = `${product.id}:${size.id}:${trimmedNotes}`;

      setLines((current) => {
        const existing = current.find((line) => line.key === key);
        if (existing) {
          return current.map((line) =>
            line.key === key
              ? { ...line, quantity: Math.min(line.quantity + quantity, 20) }
              : line,
          );
        }
        return [
          ...current,
          {
            key,
            productId: product.id,
            name: product.name,
            image: product.image,
            sizeId: size.id,
            sizeLabel: size.label,
            sizeDetail: size.detail,
            unitPrice: size.price,
            quantity,
            notes: trimmedNotes || undefined,
          },
        ];
      });
      setIsCartOpen(true);
    },
    [],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key
              ? { ...line, quantity: Math.min(quantity, 20) }
              : line,
          ),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((acc, line) => acc + line.quantity, 0);
    const subtotal = lines.reduce(
      (acc, line) => acc + line.unitPrice * line.quantity,
      0,
    );

    return {
      lines,
      itemCount,
      subtotal,
      isCartOpen,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
      addLine,
      setQuantity,
      removeLine,
      clearCart,
      isHydrated,
    };
  }, [lines, isCartOpen, addLine, setQuantity, removeLine, clearCart, isHydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error(
      "useCart debe usarse dentro de <CartProvider>",
    );
  }
  return context;
}
