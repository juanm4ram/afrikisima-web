import { NextRequest, NextResponse } from "next/server";

import { loadCatalog } from "@/features/catalog/data/catalog-repository";
import { shopConfig } from "@/lib/config/shop";

interface IncomingLine {
  productId: string;
  sizeId: string;
  quantity: number;
}

interface IncomingOrder {
  customer?: { name?: string; phone?: string; notes?: string };
  fulfillment?: string;
  date?: string;
  items: IncomingLine[];
}

/**
 * Fecha mínima aceptable, en UTC y con un día de tolerancia: el cliente valida
 * contra su huso horario y no queremos rechazar una fecha válida por eso.
 */
function earliestAcceptableDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + shopConfig.leadTimeDays - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Valida y "precifica" el pedido del lado del servidor antes de mandarlo a
 * WhatsApp. Los precios nunca se toman del cliente: se recalculan contra el
 * catálogo para que un carrito manipulado no altere el total.
 */
export async function POST(request: NextRequest) {
  let body: IncomingOrder;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "El pedido está vacío" }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Falta elegir la fecha de entrega" },
      { status: 422 },
    );
  }

  if (date < earliestAcceptableDate()) {
    return NextResponse.json(
      {
        error: `Los pedidos necesitan ${shopConfig.leadTimeDays} días de anticipación`,
      },
      { status: 422 },
    );
  }

  const catalog = await loadCatalog();
  const lines = [];
  for (const line of body.items) {
    const product =
      catalog.products.find((item) => item.id === line.productId) ?? null;
    const size = product?.sizes.find((item) => item.id === line.sizeId);
    const quantity = Number.isFinite(line.quantity)
      ? Math.min(Math.max(Math.trunc(line.quantity), 1), 20)
      : 1;

    if (!product || !size) {
      return NextResponse.json(
        { error: `Producto no disponible: ${line.productId}` },
        { status: 422 },
      );
    }

    lines.push({
      productId: product.id,
      name: product.name,
      sizeId: size.id,
      sizeLabel: size.label,
      unitPrice: size.price,
      quantity,
      lineTotal: size.price * quantity,
    });
  }

  const subtotal = lines.reduce((acc, line) => acc + line.lineTotal, 0);

  return NextResponse.json({
    orderId: `AFK-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    fulfillment: body.fulfillment ?? shopConfig.fulfillment[0].id,
    date,
    customer: {
      name: body.customer?.name?.slice(0, 80) ?? "",
      phone: body.customer?.phone?.slice(0, 40) ?? "",
      notes: body.customer?.notes?.slice(0, 400) ?? "",
    },
    lines,
    subtotal,
    total: subtotal,
    currency: shopConfig.currency,
  });
}
