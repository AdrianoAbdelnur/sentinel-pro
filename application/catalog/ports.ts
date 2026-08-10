import type { Capability, CapabilityPolicy, CapabilityPolicyScope, Company, CompanyCandidate, ExternalFleetIdentity, ExternalVehicleIdentity, Fleet, ProviderConnection, Vehicle } from "@/domain/catalog";

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
  listByFleetId(organizationId: string, fleetId: string): Promise<ExternalFleetIdentity[]>;
  save(identity: ExternalFleetIdentity): Promise<void>;
};

export type ExternalVehicleIdentityRepository = {
  findByConnectionAndExternalId(organizationId: string, connectionId: string, externalId: string): Promise<ExternalVehicleIdentity | undefined>;
  save(identity: ExternalVehicleIdentity): Promise<void>;
};
