"use client";

import { useState } from "react";

import { requestCatalogApi } from "./catalog-client";
import { COUNT_LABELS, RUN_STATUS_LABELS, RUN_TRIGGER_LABELS } from "./catalog-copy";
import { formatSyncDateTime } from "./format-sync-status";

type SyncCounts = { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number };
type LatestRun = { status: "active" | "succeeded" | "failed"; trigger: "initial" | "manual" | "internal" | "scheduler"; startedAt: string; completedAt?: string; counts: SyncCounts; failure?: { category: string; httpStatus?: number } };
type SyncStatus = { connectionId: string; latestRun?: LatestRun; lastSuccessAt?: string; isDue: boolean };

function failureMessage(failure: LatestRun["failure"]) {
  if (!failure) return undefined;
  const labels: Record<string, string> = { authentication: "Falló la autenticación", connectivity: "Falló la conexión", "invalid-response": "El proveedor respondió datos inválidos", timeout: "La solicitud agotó el tiempo", "rate-limited": "El proveedor limitó las solicitudes", internal: "Ocurrió un error interno" };
  return `${labels[failure.category] ?? "Falló la sincronización"}${failure.httpStatus ? ` - HTTP ${failure.httpStatus}` : ""}`;
}

export function ConnectionSyncPanel() {
  const [connectionId, setConnectionId] = useState("");
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
    if (result.error) { setStatus(undefined); setError(result.error); } else if (result.status) setStatus(result.status);
  });

  const sincronizarAhora = () => run(async () => {
    const result = await requestCatalogApi<{ status: "succeeded" | "skipped-fresh" }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/sync`, { method: "POST" });
    if (result.error) { setStatus(undefined); return setError(result.error); }
    setNotice(result.status === "skipped-fresh" ? "La conexión ya estaba sincronizada." : "Sincronización completada.");
    const refreshed = await requestCatalogApi<{ status: SyncStatus }>(`/api/admin/catalog/connections/${encodeURIComponent(connectionId)}/status`, { method: "GET" });
    if (!refreshed.error && refreshed.status) setStatus(refreshed.status); else if (refreshed.error) setStatus(undefined);
  });

  const latestRun = status?.latestRun;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">ID de conexión<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setConnectionId(event.target.value)} value={connectionId} /></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading || !connectionId.trim()} onClick={consultarEstado} type="button">Consultar estado</button>
        <button className="rounded bg-emerald-500 px-3 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading || !connectionId.trim()} onClick={sincronizarAhora} type="button">Sincronizar ahora</button>
      </div>
      {status ? (
        <section aria-label="Estado de la conexión" className="flex flex-col gap-2 rounded border border-zinc-800 p-3 text-sm">
          <p>Conexión: {status.connectionId}</p>
          <p>{status.isDue ? "Sincronización pendiente." : "Sincronización al día."}</p>
          <p>Último éxito: {formatSyncDateTime(status.lastSuccessAt)}</p>
          {latestRun ? (
            <>
              <p>Estado: {RUN_STATUS_LABELS[latestRun.status]}</p>
              <p>Disparador: {RUN_TRIGGER_LABELS[latestRun.trigger]}</p>
              <p>Inicio: {formatSyncDateTime(latestRun.startedAt)}</p>
              <p>Fin: {formatSyncDateTime(latestRun.completedAt)}</p>
              <ul>{(Object.keys(COUNT_LABELS) as (keyof SyncCounts)[]).map((key) => <li key={key}>{COUNT_LABELS[key]}: {latestRun.counts[key]}</li>)}</ul>
              {latestRun.failure ? <p role="alert">{failureMessage(latestRun.failure)}</p> : null}
            </>
          ) : <p>Todavía no hay sincronizaciones registradas.</p>}
        </section>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
