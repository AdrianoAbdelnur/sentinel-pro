"use client";

import { useState } from "react";

import { requestCatalogApi } from "./catalog-client";
import { REVIEW_SUBJECT_LABELS } from "./catalog-copy";

export type ReviewSummary = {
  id: string;
  externalId: string;
  subject: "fleet-binding" | "vehicle-match";
  status: "pending" | "resolved";
  candidateFleetIds?: string[];
  candidateVehicleIds?: string[];
  evidence?: { kind: "registered-plate" | "display-name-equals-registered-plate"; normalizedValue: string };
};

export function ReviewItem({ review, onResolved }: { review: ReviewSummary; onResolved: (reviewId: string) => void }) {
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const candidateIds = review.subject === "fleet-binding" ? review.candidateFleetIds : review.candidateVehicleIds;
  const targetLabel = review.subject === "fleet-binding" ? "ID de la Fleet existente" : "ID del Vehículo existente";

  async function resolver(target: { targetId: string } | { new: true }) {
    setLoading(true);
    setError(undefined);
    const result = await requestCatalogApi(`/api/admin/catalog/reviews/${encodeURIComponent(review.id)}/resolve`, { method: "POST", body: JSON.stringify(target) });
    setLoading(false);
    if (result.error) setError(result.error); else onResolved(review.id);
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-800 p-3 text-sm">
      <p>{REVIEW_SUBJECT_LABELS[review.subject]} — Pendiente</p>
      <p>Externo: {review.externalId}</p>
      {review.evidence ? <p>Evidencia: {review.evidence.kind} ({review.evidence.normalizedValue})</p> : null}
      <p>Candidatos (IDs): {candidateIds?.length ? candidateIds.join(", ") : "Sin candidatos."}</p>
      <label className="flex flex-col gap-1">{targetLabel}<input className="rounded border border-zinc-700 bg-zinc-950 p-2" onChange={(event) => setTargetId(event.target.value)} value={targetId} /></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading || !targetId.trim()} onClick={() => resolver({ targetId: targetId.trim() })} type="button">Resolver a existente</button>
        {review.subject === "vehicle-match" ? <button className="rounded bg-emerald-500 px-3 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading} onClick={() => resolver({ new: true })} type="button">Resolver a Vehículo nuevo</button> : null}
      </div>
      {review.subject === "fleet-binding" ? <p className="text-xs text-zinc-400">Las revisiones de vinculación de flota solo pueden resolverse a una Fleet existente.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
