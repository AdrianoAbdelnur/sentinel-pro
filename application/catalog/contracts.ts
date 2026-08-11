import type { CapabilityPolicy, CatalogReview, CatalogSyncCounts, CatalogSyncFailure, Company, CompanyCandidate, Fleet, Vehicle } from "@/domain/catalog";

export type CreateCompanyResult =
  | { kind: "created"; company: Company; unassignedFleet: Fleet }
  | { kind: "forbidden" };

export type CreateFleetResult = { kind: "created"; fleet: Fleet } | { kind: "forbidden" };

export type CreateVehicleResult = { kind: "created"; vehicle: Vehicle } | { kind: "forbidden" };

export type CompanyHierarchy = { company: Company; fleets: Fleet[]; vehicles: Vehicle[] };

export type GetCompanyHierarchyResult = { kind: "found"; hierarchy: CompanyHierarchy } | { kind: "forbidden" };

export type PlaceVehicleCandidatesResult = { kind: "placed"; vehicles: Vehicle[] } | { kind: "forbidden" };

export type AssignVehicleFleetResult = { kind: "assigned"; vehicle: Vehicle } | { kind: "forbidden" };

export type StageCompanyCandidateResult =
  | { kind: "staged"; candidate: CompanyCandidate }
  | { kind: "repeated"; candidate: CompanyCandidate };

export type BindProviderCompanyResult = { kind: "bound"; candidate: CompanyCandidate } | { kind: "forbidden" };

export type SetCapabilityPolicyResult = { kind: "set"; policy: CapabilityPolicy } | { kind: "forbidden" };

export type ImportCatalogResult =
  | { kind: "completed"; counts: CatalogSyncCounts; checkpoint?: string }
  | { kind: "failed"; failure: CatalogSyncFailure };

export type ReviewResolutionTarget = { targetId: string };

export type ResolveCatalogReviewResult =
  | { kind: "resolved"; review: CatalogReview }
  | { kind: "already-resolved" }
  | { kind: "not-found" }
  | { kind: "forbidden" };

export type ListPendingCatalogReviewsResult = { kind: "listed"; reviews: CatalogReview[] } | { kind: "forbidden" };
