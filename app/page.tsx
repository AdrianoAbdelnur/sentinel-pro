import { requirePageAuthorization } from "./require-page-authorization";

export default async function Home() {
  await requirePageAuthorization("operator");
  return (
    <main className="flex min-h-screen flex-col justify-center bg-zinc-950 px-6 py-20 text-zinc-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="space-y-3"><p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Sentinel Pro</p><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Greenfield foundation ready for Gentle AI, SDD, and TDD.</h1><p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">This repository is bootstrapped to implement the new provider-agnostic Sentinel architecture without inheriting the maintenance debt of the legacy prototype.</p></div>
        <section aria-labelledby="foundation-checklist-title" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6"><h2 id="foundation-checklist-title" className="text-lg font-semibold text-zinc-100">Foundation checklist</h2><ul className="mt-4 space-y-3 text-sm text-zinc-300"><li>Architecture guardrails documented in AGENTS.md</li><li>OpenSpec initialized for SDD-driven changes</li><li>Vitest + Testing Library configured for TDD</li><li>Ready for the first vertical slice implementation</li></ul></section>
      </div>
    </main>
  );
}
