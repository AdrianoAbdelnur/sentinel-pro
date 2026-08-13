import type { CapabilityPolicy, CatalogReview, CatalogSyncCounts, CatalogSyncFailure, Company, CompanyCandidate, Fleet, ProviderConnection, Vehicle } from "@/domain/catalog";

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

export type AssignConnectionCompanyResult = { kind: "assigned"; connection: ProviderConnection } | { kind: "forbidden" };

export type SetCapabilityPolicyResult = { kind: "set"; policy: CapabilityPolicy } | { kind: "forbidden" };

export type ImportCatalogResult =
  | { kind: "completed"; counts: CatalogSyncCounts; checkpoint?: string }
  | { kind: "failed"; failure: CatalogSyncFailure };

export type CatalogImportProgress = {
  total: number;
  processed: number;
  counts: CatalogSyncCounts;
};

export type ReviewResolutionTarget = { kind: "existing"; targetId: string } | { kind: "new" };

export type ResolveCatalogReviewResult =
  | { kind: "resolved"; review: CatalogReview }
  | { kind: "already-resolved" }
  | { kind: "conflict" }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "unsupported" };

export type ListPendingCatalogReviewsResult = { kind: "listed"; reviews: CatalogReview[] } | { kind: "forbidden" };
