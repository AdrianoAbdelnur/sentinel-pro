"use client";

import { useState } from "react";

type Provider = "cybermapa" | "howen";
type Result = { status: "succeeded"; companies: number; fleets: number; counts: { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number } } | { status: "failed"; code: string; };

export function ProviderImportScreen() {
  const [provider, setProvider] = useState<Provider>("cybermapa");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | undefined>();
  async function importProvider() {
    setLoading(true); setResult(undefined);
    try {
      const response = await fetch("/api/admin/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
      setResult(await response.json() as Result);
    } catch { setResult({ status: "failed", code: "network" }); }
    finally { setLoading(false); }
  }
  return <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"><label className="flex flex-col gap-2 text-sm">Plataforma<select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2"><option value="cybermapa">Cybermapa</option><option value="howen">Howen</option></select></label><button type="button" onClick={() => void importProvider()} disabled={loading} className="rounded bg-emerald-500 px-4 py-3 font-medium text-zinc-950 disabled:opacity-60">{loading ? "Importando..." : "Importar empresas y vehículos"}</button>{result?.status === "succeeded" ? <div role="status" className="rounded border border-emerald-800 bg-emerald-950/40 p-4 text-sm">Importación completada: {result.companies} empresas, {result.fleets} flotas. Registros procesados: {result.counts.processed}. Vehículos guardados: {result.counts.created + result.counts.linked}. Pendientes de revisión: {result.counts.reviewed}.</div> : null}{result?.status === "failed" ? <p role="alert" className="text-sm text-red-300">No se pudo completar la importación. Revisá el estado de la plataforma e intentá nuevamente.</p> : null}</section>;
}
