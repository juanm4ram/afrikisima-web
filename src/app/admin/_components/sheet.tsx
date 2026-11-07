import Link from "next/link";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";

export function SheetHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`border-b border-r px-3 py-3 font-semibold last:border-r-0 ${className}`}>
      {children}
    </th>
  );
}

export function SheetCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-r px-3 py-2.5 align-middle last:border-r-0 ${className}`}>{children}</td>;
}

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-100 text-sky-800",
};

export function StatusBadge({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function FormulaCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-r p-3 last:border-r-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm tabular-nums">{value}</strong>
      <span className="mt-1 block text-[10px] text-muted-foreground">{detail}</span>
    </div>
  );
}

export function SheetNumberInput({ name, value, label }: { name: string; value: number | string; label: string }) {
  return (
    <label className="block border-b border-r p-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0">
      {label}
      <Input name={name} type="number" min="0" step="0.01" defaultValue={String(value)} className="mt-1 h-9 bg-white text-right text-sm font-normal normal-case tracking-normal" required />
    </label>
  );
}

export function SectionCard({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-muted/20 p-5">
        <div>
          {eyebrow && (
            <span className="mb-2 inline-flex rounded-md border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </span>
          )}
          <h2 className="text-2xl">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Pastillas de filtro que se resuelven en el servidor mediante la URL. */
export function FilterPills({
  options,
  active,
  hrefFor,
}: {
  options: { value: string; label: string; count?: number }[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            scroll={false}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`ml-1.5 tabular-nums ${isActive ? "opacity-80" : "opacity-60"}`}>{option.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Buscador GET: conserva la vista y los filtros actuales como campos ocultos. */
export function SearchBox({
  defaultValue,
  placeholder,
  hidden,
}: {
  defaultValue: string;
  placeholder: string;
  hidden: Record<string, string>;
}) {
  return (
    <form method="get" className="flex w-full max-w-sm gap-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Input name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} className="h-9 bg-white" />
      <button type="submit" className="rounded-md border bg-background px-3 text-xs hover:bg-muted">
        Buscar
      </button>
    </form>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function formatNullablePrice(value: number | string | null | undefined, fallback = "—") {
  return value === null || value === undefined ? fallback : formatPrice(Number(value));
}

export function formatQuantity(value: number | string) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(value));
}

export function unitLabel(unit: string) {
  if (unit === "unit") return "u.";
  return unit;
}

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
