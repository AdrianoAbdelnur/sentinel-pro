import type { Company, Fleet, Vehicle } from "@/domain/catalog";

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
