import { NextResponse } from "next/server";

import type { CatalogSyncOutcome, ReviewResolutionTarget } from "@/application/catalog";
import type { CatalogReview, CompanyCandidate, ProviderConnection } from "@/domain/catalog";

export function catalogForbidden() {
  return NextResponse.json({ error: "No tenés permisos para realizar esta acción." }, { status: 403 });
}

export function unsupportedProvider() {
  return NextResponse.json({ error: "Este proveedor todavía no admite sincronización." }, { status: 409 });
}

export function unsupportedResolution() {
  return NextResponse.json({ error: "Este tipo de revisión no admite esa resolución." }, { status: 409 });
}

export function missingCompanyAssignment() {
  return NextResponse.json({ error: "Esta conexión no tiene una Company asignada. Asigná una Company para poder sincronizar." }, { status: 409 });
}

export function providerMisconfigured() {
  return NextResponse.json({ error: "La conexión con el proveedor está mal configurada. Contactá al equipo técnico." }, { status: 502 });
}

export function toSyncOutcomeResponse(outcome: CatalogSyncOutcome) {
  switch (outcome.kind) {
    case "succeeded": return NextResponse.json({ status: "succeeded", counts: outcome.run.counts });
    case "skipped-fresh": return NextResponse.json({ status: "skipped-fresh" });
    case "already-running": return NextResponse.json({ error: "Ya hay una sincronización en curso para esta conexión." }, { status: 409 });
    case "retryable-failure": return NextResponse.json({ error: "La sincronización falló y puede reintentarse.", retryable: true }, { status: 502 });
    case "not-found": return catalogForbidden();
    default: { const neverResult: never = outcome; return neverResult; }
  }
}

export function alreadyResolved() {
  return NextResponse.json({ error: "Esta revisión ya fue resuelta." }, { status: 409 });
}

export function reviewIdentityConflict() {
  return NextResponse.json({ error: "The external identity is already associated with another Vehicle." }, { status: 409 });
}

export function badRequest() {
  return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
}

export function parseReviewTarget(body: Record<string, unknown>): ReviewResolutionTarget | undefined {
  if (body.new === true) return { kind: "new" };
  return typeof body.targetId === "string" && body.targetId.trim() ? { kind: "existing", targetId: body.targetId } : undefined;
}

export function toCandidateSummary(candidate: CompanyCandidate) {
  return { id: candidate.id, connectionId: candidate.connectionId, normalizedLabel: candidate.normalizedLabel, companyId: candidate.companyId };
}

export function toConnectionSummary(connection: ProviderConnection) {
  return { id: connection.id, companyId: connection.companyId };
}

export function toReviewSummary(review: CatalogReview) {
  const shared = { id: review.id, connectionId: review.connectionId, companyId: review.companyId, externalId: review.externalId, subject: review.subject, status: review.status };
  return review.subject === "fleet-binding"
    ? { ...shared, label: review.label, candidateFleetIds: review.candidateFleetIds, resolvedFleetId: review.resolvedFleetId }
    : { ...shared, normalizedPlate: review.normalizedPlate, evidence: review.evidence, candidateVehicleIds: review.candidateVehicleIds, resolvedVehicleId: review.resolvedVehicleId };
}
