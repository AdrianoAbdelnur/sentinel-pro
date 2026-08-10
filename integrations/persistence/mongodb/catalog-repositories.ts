import type { ClientSession, Db } from "mongodb";
import type { CompanyCandidateRepository, CompanyRepository, ExternalFleetIdentityRepository, ExternalVehicleIdentityRepository, FleetRepository, ProviderConnectionRepository, VehicleRepository } from "@/application/catalog";
import { toCompanyCandidateDocument, toCompanyCandidateDomain, toCompanyDocument, toCompanyDomain, toExternalFleetIdentityDocument, toExternalFleetIdentityDomain, toExternalVehicleIdentityDocument, toExternalVehicleIdentityDomain, toFleetDocument, toFleetDomain, toProviderConnectionDocument, toProviderConnectionDomain, toVehicleDocument, toVehicleDomain, type CompanyCandidateDocument, type CompanyDocument, type ExternalFleetIdentityDocument, type ExternalVehicleIdentityDocument, type FleetDocument, type ProviderConnectionDocument, type VehicleDocument } from "./catalog-documents";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();

export type MongoCatalogRepositories = { companies: CompanyRepository; fleets: FleetRepository; vehicles: VehicleRepository; candidates: CompanyCandidateRepository; connections: ProviderConnectionRepository; fleetIdentities: ExternalFleetIdentityRepository; vehicleIdentities: ExternalVehicleIdentityRepository };

export function createMongoCatalogRepositories(db: Db, session?: ClientSession): MongoCatalogRepositories {
  const companies = db.collection<CompanyDocument>("companies");
  const fleets = db.collection<FleetDocument>("fleets");
  const vehicles = db.collection<VehicleDocument>("vehicles");
  const candidates = db.collection<CompanyCandidateDocument>("company_candidates");
  const connections = db.collection<ProviderConnectionDocument>("provider_connections");
  const fleetIdentities = db.collection<ExternalFleetIdentityDocument>("external_fleet_identities");
  const vehicleIdentities = db.collection<ExternalVehicleIdentityDocument>("external_vehicle_identities");
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
    fleetIdentities: {
      async findByConnectionAndExternalId(organizationId, connectionId, externalId) { const document = await fleetIdentities.findOne({ organizationId, connectionId, externalId }, options(session)); return document ? toExternalFleetIdentityDomain(document) : undefined; },
      async listByFleetId(organizationId, fleetId) { return (await fleetIdentities.find({ organizationId, fleetId }, options(session)).toArray()).map(toExternalFleetIdentityDomain); },
      async save(identity) { const existing = await fleetIdentities.findOne({ id: identity.id }, options(session)); await fleetIdentities.replaceOne({ id: identity.id }, toExternalFleetIdentityDocument(identity, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    vehicleIdentities: {
      async findByConnectionAndExternalId(organizationId, connectionId, externalId) { const document = await vehicleIdentities.findOne({ organizationId, connectionId, externalId }, options(session)); return document ? toExternalVehicleIdentityDomain(document) : undefined; },
      async save(identity) { const existing = await vehicleIdentities.findOne({ id: identity.id }, options(session)); await vehicleIdentities.replaceOne({ id: identity.id }, toExternalVehicleIdentityDocument(identity, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
  };
}
