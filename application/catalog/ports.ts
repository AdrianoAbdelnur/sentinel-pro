import type {
  GlobalCatalogReview,
  GlobalVehicle,
  ProviderConnection,
  ProviderContribution,
  ProviderDefinition,
  ProviderFleetMembership,
  TenantVehicleGrant,
  SentinelGroup, GroupEvidenceBinding,
} from "@/domain/catalog";

export type GlobalCatalogIdGenerator = { create(): string };

export type GlobalVehicleRepository = {
  findById(id: string): Promise<GlobalVehicle | undefined>;
  findByNormalizedPlate(normalizedPlate: string): Promise<GlobalVehicle | undefined>;
  save(vehicle: GlobalVehicle): Promise<void>;
};
export type SentinelGroupRepository = { findById(id: string): Promise<SentinelGroup | undefined>; findByLabel(label: string): Promise<SentinelGroup[]>; save(group: SentinelGroup): Promise<void> };
export type GroupEvidenceBindingRepository = { findById(id: string): Promise<GroupEvidenceBinding | undefined>; findByGroupId(groupId: string): Promise<GroupEvidenceBinding[]>; findByEvidence(connectionId: string, kind: string, externalKey: string): Promise<GroupEvidenceBinding[]>; save(binding: GroupEvidenceBinding): Promise<void> };

export type ProviderDefinitionRepository = {
  findById(id: string): Promise<ProviderDefinition | undefined>;
  findByAdapterKey(adapterKey: string): Promise<ProviderDefinition | undefined>;
  list(): Promise<ProviderDefinition[]>;
  save(provider: ProviderDefinition): Promise<void>;
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
};

export type TenantVehicleGrantRepository = {
  listByOrganizationId(organizationId: string): Promise<TenantVehicleGrant[]>;
  find(organizationId: string, vehicleId: string): Promise<TenantVehicleGrant | undefined>;
  save(grant: TenantVehicleGrant): Promise<void>;
};

export type GlobalCatalogReviewRepository = {
  findById(id: string): Promise<GlobalCatalogReview | undefined>;
  findByConnectionAndExternalId?(connectionId: string, externalId: string): Promise<GlobalCatalogReview | undefined>;
  listPending(): Promise<GlobalCatalogReview[]>;
  save(review: GlobalCatalogReview): Promise<void>;
};

export type GlobalCatalogRepositories = {
  vehicles: GlobalVehicleRepository;
  providers: ProviderDefinitionRepository;
  connections: ProviderConnectionRepository;
  contributions: ProviderContributionRepository;
  memberships: ProviderFleetMembershipRepository;
  grants: TenantVehicleGrantRepository;
  reviews: GlobalCatalogReviewRepository;
  groups: SentinelGroupRepository;
  evidenceBindings: GroupEvidenceBindingRepository;
};

export type GlobalCatalogTransactionRunner = {
  run<T>(work: (repositories: GlobalCatalogRepositories) => Promise<T>): Promise<T>;
};
