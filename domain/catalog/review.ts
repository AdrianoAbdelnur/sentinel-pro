export type CatalogReviewSubject = "fleet-binding" | "vehicle-match";
export type CatalogReviewStatus = "pending" | "resolved";

export const MAX_REVIEW_CANDIDATES = 5;

type CatalogReviewIdentity = {
  id: string;
  organizationId: string;
  connectionId: string;
  companyId: string;
  externalId: string;
  status: CatalogReviewStatus;
};

export type FleetBindingReview = CatalogReviewIdentity & {
  subject: "fleet-binding";
  label: string;
  candidateFleetIds: string[];
  resolvedFleetId?: string;
};

export type VehicleMatchReview = CatalogReviewIdentity & {
  subject: "vehicle-match";
  normalizedPlate: string;
  candidateVehicleIds: string[];
  resolvedVehicleId?: string;
};

export type CatalogReview = FleetBindingReview | VehicleMatchReview;

export function stageFleetBindingReview(
  id: string,
  params: {
    organizationId: string;
    connectionId: string;
    companyId: string;
    externalId: string;
    label: string;
    candidateFleetIds: string[];
  },
): FleetBindingReview {
  return { id, ...params, candidateFleetIds: params.candidateFleetIds.slice(0, MAX_REVIEW_CANDIDATES), subject: "fleet-binding", status: "pending" };
}

export function stageVehicleMatchReview(
  id: string,
  params: {
    organizationId: string;
    connectionId: string;
    companyId: string;
    externalId: string;
    normalizedPlate: string;
    candidateVehicleIds: string[];
  },
): VehicleMatchReview {
  return { id, ...params, candidateVehicleIds: params.candidateVehicleIds.slice(0, MAX_REVIEW_CANDIDATES), subject: "vehicle-match", status: "pending" };
}

export type CatalogReviewResolution<T> = { kind: "resolved"; review: T } | { kind: "already-resolved"; review: T };

export function resolveCatalogReviewToFleet(review: FleetBindingReview, fleetId: string): CatalogReviewResolution<FleetBindingReview> {
  if (review.status !== "pending") return { kind: "already-resolved", review };
  return { kind: "resolved", review: { ...review, status: "resolved", resolvedFleetId: fleetId } };
}

export function resolveCatalogReviewToVehicle(review: VehicleMatchReview, vehicleId: string): CatalogReviewResolution<VehicleMatchReview> {
  if (review.status !== "pending") return { kind: "already-resolved", review };
  return { kind: "resolved", review: { ...review, status: "resolved", resolvedVehicleId: vehicleId } };
}
