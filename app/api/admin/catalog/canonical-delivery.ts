import type { GlobalCatalogReview } from "@/domain/catalog-global";
import { NextResponse } from "next/server";

export function alreadyResolved() {
  return NextResponse.json({ error: "Esta revisión ya fue resuelta." }, { status: 409 });
}

export function toCanonicalReviewSummary(review: GlobalCatalogReview) {
  return {
    id: review.id,
    subject: review.subject,
    connectionId: review.connectionId,
    externalId: review.externalId,
    reason: review.reason,
    normalizedPlate: review.normalizedPlate,
    candidateVehicleIds: review.candidateVehicleIds,
    status: review.status,
    resolvedVehicleId: review.resolvedVehicleId,
    evidenceKey: review.evidenceKey,
    candidateGroupIds: review.candidateGroupIds,
  };
}
