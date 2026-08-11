"use client";

import { useState } from "react";

import { requestCatalogApi } from "./catalog-client";
import { COUNT_LABELS, RUN_STATUS_LABELS, RUN_TRIGGER_LABELS } from "./catalog-copy";
import { formatSyncDateTime, translateSyncFailureSummary } from "./format-sync-status";

type SyncCounts = { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number };
type LatestRun = { status: "active" | "succeeded" | "failed"; trigger: "initial" | "scheduled" | "manual"; startedAt: string; completedAt?: string; counts: SyncCounts; failureSummary?: string };
type SyncStatus = { connectionId: string; latestRun?: LatestRun; lastSuccessAt?: string; isDue: boolean };

export function ConnectionSyncPanel() {
  const [connectionId, setConnectionId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState<SyncStatus>();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    await action();
    setLoading(false);
  }

  const consultarEstado = () => run(async () => {
    const result = await requestCatalogApi<{ status: SyncStatus }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/status`, { method: "GET" });
    if (result.error) setError(result.error); else if (result.status) setStatus(result.status);
  });

  const sincronizarAhora = () => run(async () => {
    const result = await requestCatalogApi<{ status: "succeeded" | "skipped-fresh" }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/sync`, { method: "POST" });
    if (result.error) return setError(result.error);
    setNotice(result.status === "skipped-fresh" ? "La conexión ya estaba sincronizada." : "Sincronización completada.");
    const refreshed = await requestCatalogApi<{ status: SyncStatus }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/status`, { method: "GET" });
    if (!refreshed.error && refreshed.status) setStatus(refreshed.status);
  });

  const asignarCompany = () => run(async () => {
    const result = await requestCatalogApi<{ connection: { id: string; companyId?: string } }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/company`, { method: "POST", body: JSON.stringify({ companyId }) });
    if (result.error) setError(result.error); else setNotice("Company asignada a la conexión.");
  });

  const latestRun = status?.latestRun;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">ID de conexión<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setConnectionId(event.target.value)} value={connectionId} /></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading || !connectionId.trim()} onClick={consultarEstado} type="button">Consultar estado</button>
        <button className="rounded bg-emerald-500 px-3 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading || !connectionId.trim()} onClick={sincronizarAhora} type="button">Sincronizar ahora</button>
      </div>
      <label className="flex flex-col gap-1 text-sm">ID de Company<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setCompanyId(event.target.value)} value={companyId} /></label>
      <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading || !connectionId.trim() || !companyId.trim()} onClick={asignarCompany} type="button">Asignar Company a la conexión</button>
      {status ? (
        <section aria-label="Estado de la conexión" className="flex flex-col gap-2 rounded border border-zinc-800 p-3 text-sm">
          <p>{status.isDue ? "Sincronización pendiente." : "Sincronización al día."}</p>
          <p>Último éxito: {formatSyncDateTime(status.lastSuccessAt)}</p>
          {latestRun ? (
            <>
              <p>Estado: {RUN_STATUS_LABELS[latestRun.status]}</p>
              <p>Disparador: {RUN_TRIGGER_LABELS[latestRun.trigger]}</p>
              <p>Inicio: {formatSyncDateTime(latestRun.startedAt)}</p>
              <p>Fin: {formatSyncDateTime(latestRun.completedAt)}</p>
              <ul>{(Object.keys(COUNT_LABELS) as (keyof SyncCounts)[]).map((key) => <li key={key}>{COUNT_LABELS[key]}: {latestRun.counts[key]}</li>)}</ul>
              {latestRun.failureSummary ? <p role="alert">{translateSyncFailureSummary(latestRun.failureSummary)}</p> : null}
            </>
          ) : <p>Todavía no hay sincronizaciones registradas.</p>}
        </section>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
