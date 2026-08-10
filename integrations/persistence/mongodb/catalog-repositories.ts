import type { ClientSession, Db } from "mongodb";
import type { CapabilityPolicyRepository, CatalogImportItemRepository, CatalogReviewRepository, CatalogSyncLeaseRepository, CatalogSyncRunRepository, CompanyCandidateRepository, CompanyRepository, ExternalFleetIdentityRepository, ExternalVehicleIdentityRepository, FleetRepository, ProviderConnectionRepository, VehicleRepository } from "@/application/catalog";
import { toCapabilityPolicyDocument, toCapabilityPolicyDomain, toCatalogImportItemDocument, toCatalogImportItemDomain, toCatalogReviewDocument, toCatalogReviewDomain, toCatalogSyncRunDocument, toCatalogSyncRunDomain, toCompanyCandidateDocument, toCompanyCandidateDomain, toCompanyDocument, toCompanyDomain, toExternalFleetIdentityDocument, toExternalFleetIdentityDomain, toExternalVehicleIdentityDocument, toExternalVehicleIdentityDomain, toFleetDocument, toFleetDomain, toProviderConnectionDocument, toProviderConnectionDomain, toVehicleDocument, toVehicleDomain, type CapabilityPolicyDocument, type CatalogImportItemDocument, type CatalogReviewDocument, type CatalogSyncLeaseDocument, type CatalogSyncRunDocument, type CompanyCandidateDocument, type CompanyDocument, type ExternalFleetIdentityDocument, type ExternalVehicleIdentityDocument, type FleetDocument, type ProviderConnectionDocument, type VehicleDocument } from "./catalog-documents";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();
const isDuplicateKeyError = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;

export type MongoCatalogRepositories = { companies: CompanyRepository; fleets: FleetRepository; vehicles: VehicleRepository; candidates: CompanyCandidateRepository; connections: ProviderConnectionRepository; fleetIdentities: ExternalFleetIdentityRepository; vehicleIdentities: ExternalVehicleIdentityRepository; reviews: CatalogReviewRepository; capabilityPolicies: CapabilityPolicyRepository; importItems: CatalogImportItemRepository; syncRuns: CatalogSyncRunRepository; syncLeases: CatalogSyncLeaseRepository };

export function createMongoCatalogRepositories(db: Db, session?: ClientSession): MongoCatalogRepositories {
  const companies = db.collection<CompanyDocument>("companies");
  const fleets = db.collection<FleetDocument>("fleets");
  const vehicles = db.collection<VehicleDocument>("vehicles");
  const candidates = db.collection<CompanyCandidateDocument>("company_candidates");
  const connections = db.collection<ProviderConnectionDocument>("provider_connections");
  const fleetIdentities = db.collection<ExternalFleetIdentityDocument>("external_fleet_identities");
  const vehicleIdentities = db.collection<ExternalVehicleIdentityDocument>("external_vehicle_identities");
  const reviews = db.collection<CatalogReviewDocument>("catalog_reviews");
  const capabilityPolicies = db.collection<CapabilityPolicyDocument>("capability_policies");
  const importItems = db.collection<CatalogImportItemDocument>("catalog_import_items");
  const syncRunsCollection = db.collection<CatalogSyncRunDocument>("catalog_import_runs");
  const syncLeasesCollection = db.collection<CatalogSyncLeaseDocument>("catalog_sync_leases");
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
      async listByConnection(organizationId, connectionId) { return (await fleetIdentities.find({ organizationId, connectionId }, options(session)).toArray()).map(toExternalFleetIdentityDomain); },
      async listByFleetId(organizationId, fleetId) { return (await fleetIdentities.find({ organizationId, fleetId }, options(session)).toArray()).map(toExternalFleetIdentityDomain); },
      async save(identity) { const existing = await fleetIdentities.findOne({ id: identity.id }, options(session)); await fleetIdentities.replaceOne({ id: identity.id }, toExternalFleetIdentityDocument(identity, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    vehicleIdentities: {
      async findByConnectionAndExternalId(organizationId, connectionId, externalId) { const document = await vehicleIdentities.findOne({ organizationId, connectionId, externalId }, options(session)); return document ? toExternalVehicleIdentityDomain(document) : undefined; },
      async listByConnection(organizationId, connectionId) { return (await vehicleIdentities.find({ organizationId, connectionId }, options(session)).toArray()).map(toExternalVehicleIdentityDomain); },
      async listStaleByRun(organizationId, connectionId, currentRunId) { return (await vehicleIdentities.find({ organizationId, connectionId, presence: { $ne: "absent" }, lastSeenRunId: { $ne: currentRunId } }, options(session)).toArray()).map(toExternalVehicleIdentityDomain); },
      async save(identity) { const existing = await vehicleIdentities.findOne({ id: identity.id }, options(session)); await vehicleIdentities.replaceOne({ id: identity.id }, toExternalVehicleIdentityDocument(identity, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    reviews: {
      async findById(id) { const document = await reviews.findOne({ id }, options(session)); return document ? toCatalogReviewDomain(document) : undefined; },
      async findByConnectionAndExternalId(organizationId, connectionId, externalId, subject) { const document = await reviews.findOne({ organizationId, connectionId, externalId, subject }, options(session)); return document ? toCatalogReviewDomain(document) : undefined; },
      async listPendingByOrganization(organizationId) { return (await reviews.find({ organizationId, status: "pending" }, options(session)).toArray()).map(toCatalogReviewDomain); },
      async save(review) { const existing = await reviews.findOne({ id: review.id }, options(session)); await reviews.replaceOne({ id: review.id }, toCatalogReviewDocument(review, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
      async resolve(review) {
        const existing = await reviews.findOne({ id: review.id }, options(session));
        const result = await reviews.updateOne({ id: review.id, status: "pending" }, { $set: toCatalogReviewDocument(review, now(), existing ?? undefined) }, options(session));
        return result.matchedCount === 1 ? "resolved" : "already-resolved";
      },
    },
    capabilityPolicies: {
      async findByScope(organizationId, scope, scopeId, capability) { const document = await capabilityPolicies.findOne({ organizationId, scope, scopeId, capability }, options(session)); return document ? toCapabilityPolicyDomain(document) : undefined; },
      async save(policy) { const existing = await capabilityPolicies.findOne({ id: policy.id }, options(session)); await capabilityPolicies.replaceOne({ id: policy.id }, toCapabilityPolicyDocument(policy, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    importItems: {
      async findByRunAndExternalId(organizationId, connectionId, runId, externalId) { const document = await importItems.findOne({ organizationId, connectionId, runId, externalId }, options(session)); return document ? toCatalogImportItemDomain(document) : undefined; },
      async listPendingByRun(organizationId, connectionId, runId) { return (await importItems.find({ organizationId, connectionId, runId, status: "pending" }, options(session)).sort({ externalId: 1 }).toArray()).map(toCatalogImportItemDomain); },
      async save(item) { const existing = await importItems.findOne({ id: item.id }, options(session)); await importItems.replaceOne({ id: item.id }, toCatalogImportItemDocument(item, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    syncRuns: {
      async findById(id) { const document = await syncRunsCollection.findOne({ id }, options(session)); return document ? toCatalogSyncRunDomain(document) : undefined; },
      async findLatest(organizationId, connectionId) { const document = await syncRunsCollection.find({ organizationId, connectionId }, options(session)).sort({ startedAt: -1 }).limit(1).next(); return document ? toCatalogSyncRunDomain(document) : undefined; },
      async findLastSuccess(organizationId, connectionId) { const document = await syncRunsCollection.find({ organizationId, connectionId, status: "succeeded" }, options(session)).sort({ completedAt: -1 }).limit(1).next(); return document ? toCatalogSyncRunDomain(document) : undefined; },
      async claimActive(run) { try { await syncRunsCollection.insertOne(toCatalogSyncRunDocument(run, now()), options(session)); return "claimed"; } catch (error) { if (isDuplicateKeyError(error)) return "already-active"; throw error; } },
      async save(run) { const existing = await syncRunsCollection.findOne({ id: run.id }, options(session)); await syncRunsCollection.replaceOne({ id: run.id }, toCatalogSyncRunDocument(run, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    syncLeases: {
      async claim(organizationId, connectionId, runId, claimNow, leaseDurationMs) {
        const leaseUntil = new Date(claimNow.getTime() + leaseDurationMs);
        try {
          const before = await syncLeasesCollection.findOneAndUpdate({ organizationId, connectionId, $or: [{ leaseUntil: { $lte: claimNow } }, { runId }] }, { $set: { runId, leaseUntil, updatedAt: claimNow }, $setOnInsert: { schemaVersion: 1, createdAt: claimNow } }, { upsert: true, returnDocument: "before", ...options(session) });
          return before && before.runId !== runId ? { outcome: "claimed", previousRunId: before.runId } : { outcome: "claimed" };
        } catch (error) {
          if (isDuplicateKeyError(error)) return { outcome: "held" };
          throw error;
        }
      },
      async release(organizationId, connectionId, runId) { await syncLeasesCollection.deleteOne({ organizationId, connectionId, runId }, options(session)); },
    },
  };
}
