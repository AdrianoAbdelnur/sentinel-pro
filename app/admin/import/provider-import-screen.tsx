"use client";

import { useEffect, useState } from "react";

type Provider = "cybermapa" | "howen";
type Counts = { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number };
type Found = { companies: number; fleets: number; vehicles: number };
type Progress = { phase: "loading" | "saving"; found: Found; total: number; processed: number; counts: Counts };
type Result = { provider: Provider; status: "succeeded"; found: Found; companies: number; fleets: number; counts: Counts } | { provider: Provider; status: "failed"; code: string };

const initialCounts: Counts = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
const initialProgress: Progress = { phase: "loading", found: { companies: 0, fleets: 0, vehicles: 0 }, total: 0, processed: 0, counts: initialCounts };

function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Stat({ label, value, tone = "text-zinc-100" }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3"><p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value.toLocaleString("es-AR")}</p></div>;
}

export function ProviderImportScreen() {
  const [provider, setProvider] = useState<Provider>("cybermapa");
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (!loading || startedAt === undefined) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [loading, startedAt]);

  async function importProvider() {
    const start = Date.now();
    setLoading(true); setStartedAt(start); setElapsed(0); setProgress(initialProgress); setResult(undefined);
    try {
      const response = await fetch("/api/admin/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
      if (!response.body) throw new Error("Import stream unavailable");
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        buffer += chunk.value ?? "";
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as { type: "progress" | "result"; data: Progress | Result };
          if (event.type === "progress") setProgress(event.data as Progress);
          else setResult(event.data as Result);
        }
        if (chunk.done) break;
      }
    } catch { setResult({ provider, status: "failed", code: "network" }); }
    finally { setElapsed(Date.now() - start); setLoading(false); }
  }

  const visible = loading ? progress : result?.status === "succeeded" ? { ...progress, found: result.found, counts: result.counts, processed: result.counts.processed, total: result.found.vehicles } : progress;
  const phaseLabel = visible.phase === "loading" ? "Consultando la plataforma" : "Guardando el catálogo";

  return <section className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
    <label className="flex flex-col gap-2 text-sm">Plataforma<select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2"><option value="cybermapa">Cybermapa</option><option value="howen">Howen</option></select></label>
    <button type="button" onClick={() => void importProvider()} disabled={loading} className="rounded bg-emerald-500 px-4 py-3 font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60">{loading ? "Importando catálogo..." : "Importar empresas y vehículos"}</button>
    {loading || result ? <div className="flex flex-col gap-4" aria-live="polite">
      {loading ? <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-sm"><div><p className="font-medium text-emerald-300">{phaseLabel}</p><p className="mt-1 text-zinc-500">Los datos se actualizan a medida que se procesan.</p></div><span className="font-mono tabular-nums text-zinc-400">{formatDuration(elapsed)}</span></div> : null}
      {result?.status === "succeeded" ? <div className="border-b border-emerald-900 pb-3 text-sm text-emerald-300">Importación completada en {formatDuration(elapsed)}.</div> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Encontrados" value={visible.found.vehicles} tone="text-cyan-300" /><Stat label="Procesados" value={visible.processed} /><Stat label="Guardados" value={visible.counts.created} tone="text-emerald-300" /><Stat label="Vinculados" value={visible.counts.linked} tone="text-amber-300" /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Flotas detectadas" value={visible.found.fleets} /><Stat label="Empresas detectadas" value={visible.found.companies} /><Stat label="Revisión" value={visible.counts.reviewed} tone="text-orange-300" /><Stat label="Rechazados" value={visible.counts.rejected} tone="text-red-300" /></div>
      {result?.status === "failed" ? <p role="alert" className="text-sm text-red-300">No se pudo completar la importación. Revisá el estado de la plataforma e intentá nuevamente.</p> : null}
    </div> : null}
  </section>;
}
