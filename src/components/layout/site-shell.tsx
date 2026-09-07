"use client";

import { usePathname } from "next/navigation";

import { ErrorBoundary } from "./error-boundary";
import { SiteHeader } from "./site-header";
import { WhatsappFab } from "./whatsapp-fab";
import { CartProvider, CartSheet } from "@/features/cart";
import { Toaster } from "@/components/ui/sonner";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return (
      <ErrorBoundary>
        {children}
        <Toaster position="top-center" />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <CartProvider>
        <SiteHeader />
        {children}
        <CartSheet />
        <WhatsappFab />
        <Toaster position="top-center" />
      </CartProvider>
    </ErrorBoundary>
  );
}
