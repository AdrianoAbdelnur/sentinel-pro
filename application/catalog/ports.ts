import type {
  CatalogReview,
  CatalogVehicle,
  ProviderConnection,
  ProviderContribution,
  Provider,
  ProviderFleetMembership,
  OrganizationVehicleAccess,
  CatalogGroup, GroupEvidenceBinding, CatalogDevice, ProviderVehicleObservation,
} from "@/domain/catalog";

export type CatalogIdGenerator = { create(): string };

export type CatalogVehicleRepository = {
  findById(id: string): Promise<CatalogVehicle | undefined>;
  findByNormalizedPlate(normalizedPlate: string): Promise<CatalogVehicle | undefined>;
  save(vehicle: CatalogVehicle): Promise<void>;
};
export type CatalogPagedVehicles = { items: CatalogVehicle[]; total: number };
export type CatalogGroupRepository = { findById(id: string): Promise<CatalogGroup | undefined>; findByLabel(label: string): Promise<CatalogGroup[]>; save(group: CatalogGroup): Promise<void> };
export type GroupEvidenceBindingRepository = { findById(id: string): Promise<GroupEvidenceBinding | undefined>; findByGroupId(groupId: string): Promise<GroupEvidenceBinding[]>; findByEvidence(connectionId: string, kind: string, externalKey: string): Promise<GroupEvidenceBinding[]>; save(binding: GroupEvidenceBinding): Promise<void> };

export type ProviderRepository = {
  findById(id: string): Promise<Provider | undefined>;
  findByAdapterKey(adapterKey: string): Promise<Provider | undefined>;
  list(): Promise<Provider[]>;
  save(provider: Provider): Promise<void>;
};

export type ProviderConnectionRepository = {
  findById(id: string): Promise<ProviderConnection | undefined>;
  findEnabledByProviderId(providerId: string): Promise<ProviderConnection | undefined>;
  listEnabled(): Promise<ProviderConnection[]>;
  save(connection: ProviderConnection): Promise<void>;
};

export type ProviderContributionRepository = {
  findByConnectionAndExternalId(connectionId: string, externalId: string): Promise<ProviderContribution | undefined>;
  listByConnectionId(connectionId: string): Promise<ProviderContribution[]>;
  listByVehicleId(vehicleId: string): Promise<ProviderContribution[]>;
  save(contribution: ProviderContribution): Promise<void>;
};

export type ProviderFleetMembershipRepository = {
  listByVehicleId(vehicleId: string): Promise<ProviderFleetMembership[]>;
  listByConnectionAndExternalFleet(connectionId: string, externalFleetId: string): Promise<ProviderFleetMembership[]>;
  save(membership: ProviderFleetMembership): Promise<void>;
  replaceCurrent?(membership: ProviderFleetMembership): Promise<void>;
  clearCurrent?(connectionId: string, vehicleId: string): Promise<void>;
};

export type OrganizationVehicleAccessRepository = {
  listByOrganizationId(organizationId: string): Promise<OrganizationVehicleAccess[]>;
  find(organizationId: string, vehicleId: string): Promise<OrganizationVehicleAccess | undefined>;
  save(grant: OrganizationVehicleAccess): Promise<void>;
};

export type CatalogReviewRepository = {
  findById(id: string): Promise<CatalogReview | undefined>;
  findByConnectionAndExternalId?(connectionId: string, externalId: string): Promise<CatalogReview | undefined>;
  listPending(): Promise<CatalogReview[]>;
  save(review: CatalogReview): Promise<void>;
};

export type CatalogRepositories = {
  vehicles: CatalogVehicleRepository;
  providers: ProviderRepository;
  connections: ProviderConnectionRepository;
  contributions: ProviderContributionRepository;
  memberships: ProviderFleetMembershipRepository;
  grants: OrganizationVehicleAccessRepository;
  reviews: CatalogReviewRepository;
  groups: CatalogGroupRepository;
  evidenceBindings: GroupEvidenceBindingRepository;
  devices?: { findByConnectionAndDeviceId(connectionId: string, deviceId: string): Promise<CatalogDevice | undefined>; listByConnectionId?(connectionId: string): Promise<CatalogDevice[]>; listByVehicleId?(vehicleId: string): Promise<CatalogDevice[]>; save(device: CatalogDevice): Promise<void> };
  observations?: { save(observation: ProviderVehicleObservation): Promise<void>; listByVehicleId?(vehicleId: string): Promise<ProviderVehicleObservation[]>; markAbsent?(connectionId: string, deviceId: string): Promise<void> };
  conflicts?: { save(conflict: import("@/domain/catalog").CatalogConflict): Promise<void>; findByVehicleId?(vehicleId: string): Promise<import("@/domain/catalog").CatalogConflict[]> };
};

export type CatalogTransactionRunner = {
  run<T>(work: (repositories: CatalogRepositories) => Promise<T>): Promise<T>;
};
