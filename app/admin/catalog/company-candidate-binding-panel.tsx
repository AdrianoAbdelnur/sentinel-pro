"use client";

import { useState } from "react";

import { requestCatalogApi } from "./catalog-client";

export function CompanyCandidateBindingPanel() {
  const [candidateId, setCandidateId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  async function vincular() {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    const result = await requestCatalogApi<{ candidate: { id: string; companyId?: string } }>(`/api/admin/catalog/companies/candidates/${encodeURIComponent(candidateId.trim())}/bind`, { method: "POST", body: JSON.stringify({ companyId: companyId.trim() }) });
    setLoading(false);
    if (result.error) setError(result.error); else setNotice("Candidato vinculado a la Company.");
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">ID del candidato<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setCandidateId(event.target.value)} value={candidateId} /></label>
      <label className="flex flex-col gap-1 text-sm">ID de Company<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setCompanyId(event.target.value)} value={companyId} /></label>
      <button className="rounded bg-emerald-500 px-3 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading || !candidateId.trim() || !companyId.trim()} onClick={vincular} type="button">Vincular candidato a la Company</button>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
