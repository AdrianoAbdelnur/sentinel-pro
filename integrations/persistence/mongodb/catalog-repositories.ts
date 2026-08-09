import type { ClientSession, Db } from "mongodb";
import type { CompanyCandidateRepository, CompanyRepository, FleetRepository, ProviderConnectionRepository, VehicleRepository } from "@/application/catalog";
import { toCompanyCandidateDocument, toCompanyCandidateDomain, toCompanyDocument, toCompanyDomain, toFleetDocument, toFleetDomain, toProviderConnectionDocument, toProviderConnectionDomain, toVehicleDocument, toVehicleDomain, type CompanyCandidateDocument, type CompanyDocument, type FleetDocument, type ProviderConnectionDocument, type VehicleDocument } from "./catalog-documents";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();

export type MongoCatalogRepositories = { companies: CompanyRepository; fleets: FleetRepository; vehicles: VehicleRepository; candidates: CompanyCandidateRepository; connections: ProviderConnectionRepository };

export function createMongoCatalogRepositories(db: Db, session?: ClientSession): MongoCatalogRepositories {
  const companies = db.collection<CompanyDocument>("companies");
  const fleets = db.collection<FleetDocument>("fleets");
  const vehicles = db.collection<VehicleDocument>("vehicles");
  const candidates = db.collection<CompanyCandidateDocument>("company_candidates");
  const connections = db.collection<ProviderConnectionDocument>("provider_connections");
  return {
    companies: {
      async findById(id) { const document = await companies.findOne({ id }, options(session)); return document ? toCompanyDomain(document) : undefined; },
      async save(company) { const existing = await companies.findOne({ id: company.id }, options(session)); await companies.replaceOne({ id: company.id }, toCompanyDocument(company, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    fleets: {
      async findById(id) { const document = await fleets.findOne({ id }, options(session)); return document ? toFleetDomain(document) : undefined; },
      async listByCompany(companyId) { return (await fleets.find({ companyId }, options(session)).toArray()).map(toFleetDomain); },
      async save(fleet) { const existing = await fleets.findOne({ id: fleet.id }, options(session)); await fleets.replaceOne({ id: fleet.id }, toFleetDocument(fleet, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    vehicles: {
      async findById(id) { const document = await vehicles.findOne({ id }, options(session)); return document ? toVehicleDomain(document) : undefined; },
      async listByCompany(companyId) { return (await vehicles.find({ companyId }, options(session)).toArray()).map(toVehicleDomain); },
      async save(vehicle) { const existing = await vehicles.findOne({ id: vehicle.id }, options(session)); await vehicles.replaceOne({ id: vehicle.id }, toVehicleDocument(vehicle, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    candidates: {
      async findById(id) { const document = await candidates.findOne({ id }, options(session)); return document ? toCompanyCandidateDomain(document) : undefined; },
      async findByConnectionAndLabel(organizationId, connectionId, normalizedLabel) { const document = await candidates.findOne({ organizationId, connectionId, normalizedLabel }, options(session)); return document ? toCompanyCandidateDomain(document) : undefined; },
      async save(candidate) { const existing = await candidates.findOne({ id: candidate.id }, options(session)); await candidates.replaceOne({ id: candidate.id }, toCompanyCandidateDocument(candidate, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    connections: {
      async findById(organizationId, id) { const document = await connections.findOne({ id, organizationId }, options(session)); return document ? toProviderConnectionDomain(document) : undefined; },
      async save(connection) { const existing = await connections.findOne({ id: connection.id, organizationId: connection.organizationId }, options(session)); await connections.replaceOne({ id: connection.id, organizationId: connection.organizationId }, toProviderConnectionDocument(connection, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
  };
}
