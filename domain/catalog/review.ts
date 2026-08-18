export type CatalogReviewReason = "missing-plate" | "malformed-plate" | "missing-placement" | "ambiguous-match" | "conflicting-identity" | "ambiguous-group-evidence";

export type CatalogReview = Readonly<{
  id: string;
  subject: "vehicle-identity";
  connectionId: string;
  externalId: string;
  reason: CatalogReviewReason;
  normalizedPlate?: string;
  candidateVehicleIds: readonly string[];
  status: "pending" | "resolved";
  resolvedVehicleId?: string;
  evidenceKey?: string;
  candidateGroupIds?: readonly string[];
}>;

export type CatalogReviewInput = {
  id: string;
  connectionId: string;
  externalId: string;
  reason: CatalogReviewReason;
  normalizedPlate?: string;
  candidateVehicleIds: readonly string[];
  evidenceKey?: string;
  candidateGroupIds?: readonly string[];
};

export function createCatalogReview(input: CatalogReviewInput): CatalogReview {
  return Object.freeze({
    ...input,
    subject: "vehicle-identity" as const,
    candidateVehicleIds: Object.freeze([...input.candidateVehicleIds]),
    status: "pending" as const,
    ...(input.evidenceKey !== undefined ? { evidenceKey: input.evidenceKey } : {}),
    ...(input.candidateGroupIds !== undefined ? { candidateGroupIds: Object.freeze([...input.candidateGroupIds]) } : {}),
  });
}

export function resolveCatalogReview(review: CatalogReview, vehicleId: string): CatalogReview {
  if (review.status === "resolved") return review;
  return Object.freeze({ ...review, status: "resolved", resolvedVehicleId: vehicleId });
}
