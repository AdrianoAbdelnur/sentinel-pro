import type { Capability, CapabilityPolicy, CapabilityPolicyScope, CatalogImportItem, CatalogReview, CatalogReviewSubject, CatalogSyncFailure, CatalogSyncRun, Company, CompanyCandidate, ExternalFleetIdentity, ExternalVehicleIdentity, Fleet, ProviderConnection, Vehicle } from "@/domain/catalog";

export type Clock = { now(): Date };

export type CompanyRepository = {
  findById(id: string): Promise<Company | undefined>;
  save(company: Company): Promise<void>;
};

export type FleetRepository = {
  findById(id: string): Promise<Fleet | undefined>;
  listByCompany(companyId: string): Promise<Fleet[]>;
  save(fleet: Fleet): Promise<void>;
};

export type VehicleRepository = {
  findById(id: string): Promise<Vehicle | undefined>;
  listByCompany(companyId: string): Promise<Vehicle[]>;
  save(vehicle: Vehicle): Promise<void>;
};

export type IdGenerator = { create(): string };

export type CatalogTransactionRepositories = {
  companies: CompanyRepository;
  fleets: FleetRepository;
  vehicles: VehicleRepository;
  vehicleIdentities: ExternalVehicleIdentityRepository;
  importItems: CatalogImportItemRepository;
};

export type CatalogTransactionRunner = {
  run<T>(work: (repositories: CatalogTransactionRepositories) => Promise<T>): Promise<T>;
};

export type CatalogApplicationPorts = {
  companies: CompanyRepository;
  fleets: FleetRepository;
  vehicles: VehicleRepository;
  ids: IdGenerator;
  transactions: CatalogTransactionRunner;
};

export type CompanyCandidateRepository = {
  findById(id: string): Promise<CompanyCandidate | undefined>;
  findByConnectionAndLabel(organizationId: string, connectionId: string, normalizedLabel: string): Promise<CompanyCandidate | undefined>;
  save(candidate: CompanyCandidate): Promise<void>;
};

export type CompanyBindingPorts = {
  companies: CompanyRepository;
  candidates: CompanyCandidateRepository;
  ids: IdGenerator;
};

export type ProviderConnectionRepository = {
  findById(organizationId: string, id: string): Promise<ProviderConnection | undefined>;
  save(connection: ProviderConnection): Promise<void>;
};

export type CapabilityPolicyRepository = {
  findByScope(
    organizationId: string,
    scope: CapabilityPolicyScope,
    scopeId: string,
    capability: Capability,
  ): Promise<CapabilityPolicy | undefined>;
  save(policy: CapabilityPolicy): Promise<void>;
};

export type CapabilityPolicyPorts = {
  companies: CompanyRepository;
  fleets: FleetRepository;
  vehicles: VehicleRepository;
  policies: CapabilityPolicyRepository;
  ids: IdGenerator;
};

export type ExternalFleetIdentityRepository = {
  findByConnectionAndExternalId(organizationId: string, connectionId: string, externalId: string): Promise<ExternalFleetIdentity | undefined>;
  listByConnection(organizationId: string, connectionId: string): Promise<ExternalFleetIdentity[]>;
  listByFleetId(organizationId: string, fleetId: string): Promise<ExternalFleetIdentity[]>;
  save(identity: ExternalFleetIdentity): Promise<void>;
};

export type ExternalVehicleIdentityRepository = {
  findByConnectionAndExternalId(organizationId: string, connectionId: string, externalId: string): Promise<ExternalVehicleIdentity | undefined>;
  listByConnection(organizationId: string, connectionId: string): Promise<ExternalVehicleIdentity[]>;
  listStaleByRun(organizationId: string, connectionId: string, currentRunId: string): Promise<ExternalVehicleIdentity[]>;
  save(identity: ExternalVehicleIdentity): Promise<void>;
};

export type CatalogSyncLeaseClaimResult = { outcome: "claimed"; previousRunId?: string } | { outcome: "held" };

export type CatalogSyncLeaseRepository = {
  claim(organizationId: string, connectionId: string, runId: string, now: Date, leaseDurationMs: number): Promise<CatalogSyncLeaseClaimResult>;
  release(organizationId: string, connectionId: string, runId: string): Promise<void>;
};

export type CatalogSyncRunRepository = {
  findById(id: string): Promise<CatalogSyncRun | undefined>;
  findLatest(organizationId: string, connectionId: string): Promise<CatalogSyncRun | undefined>;
  findLastSuccess(organizationId: string, connectionId: string): Promise<CatalogSyncRun | undefined>;
  claimActive(run: CatalogSyncRun): Promise<"claimed" | "already-active">;
  save(run: CatalogSyncRun): Promise<void>;
};

export type CatalogReviewRepository = {
  findById(id: string): Promise<CatalogReview | undefined>;
  findByConnectionAndExternalId(organizationId: string, connectionId: string, externalId: string, subject: CatalogReviewSubject): Promise<CatalogReview | undefined>;
  listPendingByOrganization(organizationId: string): Promise<CatalogReview[]>;
  save(review: CatalogReview): Promise<void>;
  resolve(review: CatalogReview): Promise<"resolved" | "already-resolved">;
};

export type CatalogImportItemRepository = {
  findByRunAndExternalId(organizationId: string, connectionId: string, runId: string, externalId: string): Promise<CatalogImportItem | undefined>;
  listPendingByRun(organizationId: string, connectionId: string, runId: string): Promise<CatalogImportItem[]>;
  save(item: CatalogImportItem): Promise<void>;
};

export type CatalogImportCandidate = {
  externalId: string;
  companyLabel: string;
  normalizedPlate?: string;
  label?: string;
  externalFleetId?: string;
  fleetLabel?: string;
};

export type CatalogSnapshotResult =
  | { kind: "complete"; candidates: CatalogImportCandidate[] }
  | { kind: "failed"; failure: CatalogSyncFailure };

export type CatalogImportSource = {
  loadCompleteSnapshot(): Promise<CatalogSnapshotResult>;
};

export type ImportCatalogPorts = {
  companies: CompanyRepository;
  fleets: FleetRepository;
  vehicles: VehicleRepository;
  candidates: CompanyCandidateRepository;
  vehicleIdentities: ExternalVehicleIdentityRepository;
  fleetIdentities: ExternalFleetIdentityRepository;
  reviews: CatalogReviewRepository;
  importItems: CatalogImportItemRepository;
  syncRuns: CatalogSyncRunRepository;
  ids: IdGenerator;
  transactions: CatalogTransactionRunner;
};

export type SynchronizeCatalogConnectionPorts = ImportCatalogPorts & {
  connections: ProviderConnectionRepository;
  syncLeases: CatalogSyncLeaseRepository;
  clock: Clock;
};
