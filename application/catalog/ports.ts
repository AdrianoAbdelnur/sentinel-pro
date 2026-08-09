import type { Capability, CapabilityPolicy, CapabilityPolicyScope, Company, CompanyCandidate, Fleet, Vehicle } from "@/domain/catalog";

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

export type CatalogApplicationPorts = {
  companies: CompanyRepository;
  fleets: FleetRepository;
  vehicles: VehicleRepository;
  ids: IdGenerator;
};

export type CompanyCandidateRepository = {
  findById(id: string): Promise<CompanyCandidate | undefined>;
  findByConnectionAndLabel(connectionId: string, normalizedLabel: string): Promise<CompanyCandidate | undefined>;
  save(candidate: CompanyCandidate): Promise<void>;
};

export type CompanyBindingPorts = {
  companies: CompanyRepository;
  candidates: CompanyCandidateRepository;
  ids: IdGenerator;
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
