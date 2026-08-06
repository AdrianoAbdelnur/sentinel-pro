import { requirePageAuthorization } from "./require-page-authorization";

export default async function Home() {
  await requirePageAuthorization("operator");
  return (
    <main className="flex min-h-screen flex-col justify-center bg-zinc-950 px-6 py-20 text-zinc-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-3"><p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Sentinel Pro</p><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Base inicial lista para Gentle AI, SDD y TDD.</h1><p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">Este repositorio está preparado para implementar la nueva arquitectura de Sentinel, independiente de proveedores y sin heredar la deuda de mantenimiento del prototipo anterior.</p></div>
        <section aria-labelledby="foundation-checklist-title" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"><h2 id="foundation-checklist-title" className="text-lg font-semibold text-zinc-100">Lista de verificación de la base</h2><ul className="mt-4 space-y-3 text-sm text-zinc-300"><li>Lineamientos de arquitectura documentados en AGENTS.md</li><li>OpenSpec inicializado para cambios guiados por SDD</li><li>Vitest y Testing Library configurados para TDD</li><li>Listo para implementar el primer corte vertical</li></ul></section>
      </div>
    </main>
  );
}
