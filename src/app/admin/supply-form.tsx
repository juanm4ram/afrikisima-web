"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSupply } from "./actions";

export function SupplyForm() {
  const [type, setType] = useState<"ingredient" | "packaging">("ingredient");

  return (
    <section className="mb-10 rounded-3xl border bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-2xl">Agregar insumo</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Elegí el tipo de insumo. Packaging requiere solamente nombre, tamaño y precio.
      </p>
      <form action={addSupply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-2">
          <Label htmlFor="supply_type">Tipo</Label>
          <select
            id="supply_type"
            name="supply_type"
            value={type}
            onChange={(event) => setType(event.target.value as "ingredient" | "packaging")}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="ingredient">Ingrediente</option>
            <option value="packaging">Packaging</option>
          </select>
        </div>

        <Field className="lg:col-span-2" label="Nombre" name="name" />

        {type === "packaging" ? (
          <>
            <Field label="Tamaño" name="size_label" placeholder="Ej.: 25 × 25 × 12 cm" />
            <Field label="Precio" name="package_price" type="number" step="0.01" />
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="base_unit">Unidad usada</Label>
              <select id="base_unit" name="base_unit" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                <option value="g">gramos</option>
                <option value="ml">mililitros</option>
                <option value="unit">unidades</option>
              </select>
            </div>
            <Field label="Contenido" name="package_quantity" type="number" step="0.01" />
            <div className="space-y-2">
              <Label htmlFor="purchase_unit">Unidad de compra</Label>
              <select id="purchase_unit" name="purchase_unit" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" required>
                <option value="g">gramos</option>
                <option value="kg">kilogramos</option>
                <option value="ml">mililitros</option>
                <option value="l">litros</option>
                <option value="unit">unidad</option>
              </select>
            </div>
            <Field label="Precio" name="package_price" type="number" step="0.01" />
            <Field label="Equivale a unidad usada" name="conversion_to_base" type="number" step="0.001" placeholder="Automático" required={false} />
            <Field label="Marca" name="brand" required={false} />
            <Field label="Proveedor" name="supplier" required={false} />
          </>
        )}

        <div className="flex items-end lg:col-span-2">
          <Button type="submit">Guardar insumo</Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  placeholder,
  required = true,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`new-${name}`}>{label}</Label>
      <Input
        id={`new-${name}`}
        name={name}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={step}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
