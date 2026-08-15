export type GlobalCatalogReviewReason = "missing-plate" | "malformed-plate" | "ambiguous-match" | "conflicting-identity";

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
}>;

export type GlobalCatalogReviewInput = {
  id: string;
  connectionId: string;
  externalId: string;
  reason: GlobalCatalogReviewReason;
  normalizedPlate?: string;
  candidateVehicleIds: readonly string[];
};

export function createGlobalCatalogReview(input: GlobalCatalogReviewInput): GlobalCatalogReview {
  return Object.freeze({
    ...input,
    subject: "vehicle-identity" as const,
    candidateVehicleIds: Object.freeze([...input.candidateVehicleIds]),
    status: "pending" as const,
  });
}

export function resolveGlobalCatalogReview(review: GlobalCatalogReview, vehicleId: string): GlobalCatalogReview {
  if (review.status === "resolved") return review;
  return Object.freeze({ ...review, status: "resolved", resolvedVehicleId: vehicleId });
}
