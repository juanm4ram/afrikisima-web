import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-[75vh] max-w-md items-center px-4 py-16">
      <section className="w-full rounded-3xl border bg-card p-7 shadow-sm">
        <p className="eyebrow mb-2">Administración</p>
        <h1 className="mb-2 text-3xl">Costos de Afrikísima</h1>
        <p className="mb-7 text-sm text-muted-foreground">
          Acceso privado para actualizar ingredientes y revisar precios.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
