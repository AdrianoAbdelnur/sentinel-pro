"use client";

import { useState } from "react";

import { requestCatalogApi } from "./catalog-client";

export type ReviewSummary = {
  id: string;
  externalId: string;
  subject: "vehicle-identity";
  reason: "missing-plate" | "malformed-plate" | "missing-placement" | "ambiguous-match" | "conflicting-identity" | "ambiguous-group-evidence";
  status: "pending" | "resolved";
  candidateVehicleIds: string[];
};

export function ReviewItem({ review, onResolved }: { review: ReviewSummary; onResolved: (reviewId: string) => void }) {
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function resolve() {
    setLoading(true);
    setError(undefined);
    const result = await requestCatalogApi(`/api/admin/catalog/reviews/${encodeURIComponent(review.id)}/resolve`, { method: "POST", body: JSON.stringify({ targetId: targetId.trim() }) });
    setLoading(false);
    if (result.error) setError(result.error); else onResolved(review.id);
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-800 p-3 text-sm">
      <p>Identidad de vehículo — Pendiente</p>
      <p>Externo: {review.externalId}</p>
      <p>Candidatos (IDs): {review.candidateVehicleIds.length ? review.candidateVehicleIds.join(", ") : "Sin candidatos."}</p>
      <label className="flex flex-col gap-1">ID del vehículo existente<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setTargetId(event.target.value)} value={targetId} /></label>
      <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading || !targetId.trim()} onClick={resolve} type="button">Resolver a vehículo</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
