export type GlobalCatalogReviewReason = "missing-plate" | "malformed-plate" | "missing-placement" | "ambiguous-match" | "conflicting-identity" | "ambiguous-group-evidence";

export type GlobalCatalogReview = Readonly<{
  id: string;
  subject: "vehicle-identity";
  connectionId: string;
  externalId: string;
  reason: GlobalCatalogReviewReason;
  normalizedPlate?: string;
  candidateVehicleIds: readonly string[];
  status: "pending" | "resolved";
  resolvedVehicleId?: string;
  evidenceKey?: string;
  candidateGroupIds?: readonly string[];
}>;

export type GlobalCatalogReviewInput = {
  id: string;
  connectionId: string;
  externalId: string;
  reason: GlobalCatalogReviewReason;
  normalizedPlate?: string;
  candidateVehicleIds: readonly string[];
  evidenceKey?: string;
  candidateGroupIds?: readonly string[];
};

export function createGlobalCatalogReview(input: GlobalCatalogReviewInput): GlobalCatalogReview {
  return Object.freeze({
    ...input,
    subject: "vehicle-identity" as const,
    candidateVehicleIds: Object.freeze([...input.candidateVehicleIds]),
    status: "pending" as const,
    ...(input.evidenceKey !== undefined ? { evidenceKey: input.evidenceKey } : {}),
    ...(input.candidateGroupIds !== undefined ? { candidateGroupIds: Object.freeze([...input.candidateGroupIds]) } : {}),
  });
}

export function resolveGlobalCatalogReview(review: GlobalCatalogReview, vehicleId: string): GlobalCatalogReview {
  if (review.status === "resolved") return review;
  return Object.freeze({ ...review, status: "resolved", resolvedVehicleId: vehicleId });
}
