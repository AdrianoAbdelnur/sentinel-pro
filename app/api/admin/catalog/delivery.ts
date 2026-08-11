import { NextResponse } from "next/server";

import type { ReviewResolutionTarget } from "@/application/catalog";
import type { CatalogReview } from "@/domain/catalog";

export function catalogForbidden() {
  return NextResponse.json({ error: "No tenés permisos para realizar esta acción." }, { status: 403 });
}

export function alreadyResolved() {
  return NextResponse.json({ error: "Esta revisión ya fue resuelta." }, { status: 409 });
}

export function badRequest() {
  return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
}

export function parseReviewTarget(body: Record<string, unknown>): ReviewResolutionTarget | undefined {
  return typeof body.targetId === "string" && body.targetId.trim() ? { targetId: body.targetId } : undefined;
}

export function toReviewSummary(review: CatalogReview) {
  const shared = { id: review.id, connectionId: review.connectionId, companyId: review.companyId, externalId: review.externalId, subject: review.subject, status: review.status };
  return review.subject === "fleet-binding"
    ? { ...shared, label: review.label, candidateFleetIds: review.candidateFleetIds, resolvedFleetId: review.resolvedFleetId }
    : { ...shared, normalizedPlate: review.normalizedPlate, candidateVehicleIds: review.candidateVehicleIds, resolvedVehicleId: review.resolvedVehicleId };
}
