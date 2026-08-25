import type { ClientSession, Collection, Db, Filter, UpdateFilter } from "mongodb";
import type { CatalogRepositories } from "@/application/catalog/ports";
import type { CatalogGroupSummary } from "@/application/live";
import { createCapabilityPolicy, normalizeGroupLabel, type CapabilityPolicy, type CatalogVehicle, type CatalogGroup } from "@/domain/catalog";
import {
  toCatalogReviewDocument, toCatalogReviewDomain, toCatalogVehicleDocument, toCatalogVehicleDomain,
  toProviderConnectionDocument, toProviderConnectionDomain, toProviderContributionDocument, toProviderContributionDomain,
  toProviderDocument, toProviderDomain, toProviderFleetMembershipDocument, toProviderFleetMembershipDomain,
  toOrganizationVehicleAccessDocument, toOrganizationVehicleAccessDomain,
  toCatalogGroupDocument, toCatalogGroupDomain, toGroupEvidenceBindingDocument, toGroupEvidenceBindingDomain,
  type CatalogReviewDocument, type CatalogVehicleDocument, type ProviderConnectionDocument, type ProviderContributionDocument,
  type ProviderDocument, type ProviderFleetMembershipDocument, type OrganizationVehicleAccessDocument,
  type CatalogGroupDocument, type GroupEvidenceBindingDocument,
} from "./catalog-documents";
import { createCatalogSyncRepositories } from "./catalog-sync-repositories";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();
const atomicSave = async <T extends { schemaVersion: number; createdAt: Date; updatedAt: Date }>(collection: Collection<T>, filter: Filter<T>, document: T, session?: ClientSession) => {
  const { schemaVersion, createdAt, ...mutable } = document;
  await collection.updateOne(filter, { $set: mutable, $setOnInsert: { schemaVersion, createdAt } } as UpdateFilter<T>, { upsert: true, ...options(session) });
};

type CatalogLiveReadRepositories = {
  groups: CatalogRepositories["groups"] & {
    list(): Promise<CatalogGroup[]>;
    listForOrganization(organizationId: string): Promise<CatalogGroupSummary[]>;
  };
  vehicles: CatalogRepositories["vehicles"] & {
    list(): Promise<CatalogVehicle[]>;
    listByOrganizationAndGroupId(organizationId: string, groupId: string, input?: { page: number; pageSize: number; plate?: string }): Promise<{ items: CatalogVehicle[]; total: number }>;
    countByOrganizationAndGroup(organizationId: string, groupIds: readonly string[], plate?: string): Promise<Readonly<Record<string, number>>>;
    listByOrganizationAndGroupRanges(organizationId: string, ranges: readonly { groupId: string; skip: number; limit: number }[], plate?: string): Promise<CatalogVehicle[]>;
  };
  policies: { list(): Promise<CapabilityPolicy[]> };
};

type CapabilityPolicyDocument = {
  id: string;
  capability: string;
  sourceOrder: string[];
};

export function createCatalogRepositories(db: Db, session?: ClientSession): CatalogRepositories & CatalogLiveReadRepositories & ReturnType<typeof createCatalogSyncRepositories> {
  const vehicles = db.collection<CatalogVehicleDocument>("catalog_vehicles");
  const providers = db.collection<ProviderDocument>("providers");
  const connections = db.collection<ProviderConnectionDocument>("provider_connections");
  const contributions = db.collection<ProviderContributionDocument>("provider_contributions");
  const memberships = db.collection<ProviderFleetMembershipDocument>("provider_fleet_memberships");
  const grants = db.collection<OrganizationVehicleAccessDocument>("organization_vehicle_access");
  const reviews = db.collection<CatalogReviewDocument>("catalog_reviews");
  const groups = db.collection<CatalogGroupDocument>("catalog_groups");
  const evidenceBindings = db.collection<GroupEvidenceBindingDocument>("group_evidence_bindings");
  const policies = db.collection<CapabilityPolicyDocument>("capability_policies");

  return {
    ...createCatalogSyncRepositories(db, session),
    policies: {
      async list() {
        return (await policies.find({}, options(session)).sort({ id: 1 }).toArray())
          .map(({ id, capability, sourceOrder }) => createCapabilityPolicy({ id, capability, sourceOrder }));
      },
    },
    groups: {
      async list() { return (await groups.find({}, options(session)).sort({ id: 1 }).toArray()).map(toCatalogGroupDomain); },
      async listForOrganization(organizationId) {
        const counts = await grants.aggregate([
          { $match: { organizationId } },
          { $lookup: { from: "catalog_vehicles", localField: "vehicleId", foreignField: "id", as: "vehicle" } },
          { $unwind: "$vehicle" },
          { $group: { _id: "$vehicle.placementFleetId", vehicleCount: { $sum: 1 } } },
        ], options(session)).toArray();
        const countByGroupId = new Map(counts.map((entry) => [String(entry._id), Number(entry.vehicleCount)]));
        return (await groups.find({}, options(session)).sort({ id: 1 }).toArray())
          .map(toCatalogGroupDomain)
          .flatMap((group) => {
            const vehicleCount = countByGroupId.get(group.id) ?? 0;
            return vehicleCount > 0 ? [{ ...group, vehicleCount }] : [];
          });
      },
      async findById(id) { const document = await groups.findOne({ id }, options(session)); return document ? toCatalogGroupDomain(document) : undefined; },
      async findByLabel(label) { return (await groups.find({ normalizedLabel: normalizeGroupLabel(label) }, options(session)).sort({ id: 1 }).toArray()).map(toCatalogGroupDomain); },
      async save(group) { await atomicSave(groups, { id: group.id }, toCatalogGroupDocument(group, now()), session); },
    },
    evidenceBindings: {
      async findById(id) { const document = await evidenceBindings.findOne({ id }, options(session)); return document ? toGroupEvidenceBindingDomain(document) : undefined; },
      async findByGroupId(groupId) { return (await evidenceBindings.find({ groupId }, options(session)).sort({ id: 1 }).toArray()).map(toGroupEvidenceBindingDomain); },
      async findByEvidence(connectionId, kind, externalKey) { return (await evidenceBindings.find({ "evidence.connectionId": connectionId, "evidence.kind": kind, "evidence.externalKey": externalKey }, options(session)).sort({ id: 1 }).toArray()).map(toGroupEvidenceBindingDomain); },
      async save(binding) { await atomicSave(evidenceBindings, { id: binding.id }, toGroupEvidenceBindingDocument(binding, now()), session); },
    },
    vehicles: {
      async list() { return (await vehicles.find({}, options(session)).sort({ id: 1 }).toArray()).map(toCatalogVehicleDomain); },
      async listByOrganizationAndGroupId(organizationId, groupId, input = { page: 1, pageSize: 50 }) {
        const page = Math.max(1, input.page);
        const normalizedPlate = input.plate?.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const escapedPlate = normalizedPlate?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const result = await vehicles.aggregate([
          { $match: { placementFleetId: groupId, ...(escapedPlate ? { normalizedPlate: { $regex: escapedPlate } } : {}) } },
          { $lookup: { from: "organization_vehicle_access", localField: "id", foreignField: "vehicleId", as: "grant" } },
          { $match: { "grant.organizationId": organizationId } },
          { $facet: {
            metadata: [{ $count: "total" }],
            items: [{ $sort: { id: 1 } }, { $skip: (page - 1) * input.pageSize }, { $limit: input.pageSize }],
          } },
        ], options(session)).toArray();
        const facet = result[0] ?? { metadata: [], items: [] };
        return { total: Number((facet.metadata[0] as { total?: number } | undefined)?.total ?? 0), items: (facet.items as CatalogVehicleDocument[]).map(toCatalogVehicleDomain) };
      },
      async countByOrganizationAndGroup(organizationId, groupIds, plate) {
        if (groupIds.length === 0) return {};
        const normalizedPlate = plate?.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const escapedPlate = normalizedPlate?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rows = await vehicles.aggregate([
          { $match: { placementFleetId: { $in: groupIds }, ...(escapedPlate ? { normalizedPlate: { $regex: escapedPlate } } : {}) } },
          { $lookup: { from: "organization_vehicle_access", localField: "id", foreignField: "vehicleId", as: "grant" } },
          { $match: { "grant.organizationId": organizationId } },
          { $group: { _id: "$placementFleetId", count: { $sum: 1 } } },
        ], options(session)).toArray();
        return Object.fromEntries(rows.map((row) => [String(row._id), Number(row.count)]));
      },
      async listByOrganizationAndGroupRanges(organizationId, ranges, plate) {
        if (ranges.length === 0) return [];
        const normalizedPlate = plate?.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const escapedPlate = normalizedPlate?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pageResults = await Promise.all(ranges.map(async ({ groupId, skip, limit }) => {
          const documents = await vehicles.aggregate([
            { $match: { placementFleetId: groupId, ...(escapedPlate ? { normalizedPlate: { $regex: escapedPlate } } : {}) } },
            { $lookup: { from: "organization_vehicle_access", localField: "id", foreignField: "vehicleId", as: "grant" } },
            { $match: { "grant.organizationId": organizationId } },
            { $sort: { id: 1 } },
            { $skip: skip },
            { $limit: limit },
          ], options(session)).toArray();
          return documents as CatalogVehicleDocument[];
        }));
        return pageResults.flat().map(toCatalogVehicleDomain);
      },
      async findById(id) { const document = await vehicles.findOne({ id }, options(session)); return document ? toCatalogVehicleDomain(document) : undefined; },
      async findByNormalizedPlate(normalizedPlate) { const document = await vehicles.findOne({ normalizedPlate }, options(session)); return document ? toCatalogVehicleDomain(document) : undefined; },
      async save(vehicle) { await atomicSave(vehicles, { id: vehicle.id }, toCatalogVehicleDocument(vehicle, now()), session); },
    },
    providers: {
      async findById(id) { const document = await providers.findOne({ id }, options(session)); return document ? toProviderDomain(document) : undefined; },
      async findByAdapterKey(adapterKey) { const document = await providers.findOne({ adapterKey }, options(session)); return document ? toProviderDomain(document) : undefined; },
      async list() { return (await providers.find({}, options(session)).sort({ id: 1 }).toArray()).map(toProviderDomain); },
      async save(provider) { await atomicSave(providers, { id: provider.id }, toProviderDocument(provider, now()), session); },
    },
    connections: {
      async findById(id) { const document = await connections.findOne({ id }, options(session)); return document ? toProviderConnectionDomain(document) : undefined; },
      async findEnabledByProviderId(providerId) { const document = await connections.findOne({ providerId, enabled: true }, options(session)); return document ? toProviderConnectionDomain(document) : undefined; },
      async listEnabled() { return (await connections.find({ enabled: true }, options(session)).sort({ id: 1 }).toArray()).map(toProviderConnectionDomain); },
      async save(connection) { await atomicSave(connections, { id: connection.id }, toProviderConnectionDocument(connection, now()), session); },
    },
    contributions: {
      async findByConnectionAndExternalId(connectionId, externalId) { const document = await contributions.findOne({ connectionId, externalId }, options(session)); return document ? toProviderContributionDomain(document) : undefined; },
      async listByConnectionId(connectionId) { return (await contributions.find({ connectionId }, options(session)).sort({ externalId: 1 }).toArray()).map(toProviderContributionDomain); },
      async listByVehicleId(vehicleId) { return (await contributions.find({ vehicleId }, options(session)).sort({ id: 1 }).toArray()).map(toProviderContributionDomain); },
      async save(contribution) { await atomicSave(contributions, { id: contribution.id }, toProviderContributionDocument(contribution, now()), session); },
    },
    memberships: {
      async listByVehicleId(vehicleId) { return (await memberships.find({ vehicleId }, options(session)).sort({ connectionId: 1, externalFleetId: 1 }).toArray()).map(toProviderFleetMembershipDomain); },
      async listByConnectionAndExternalFleet(connectionId, externalFleetId) { return (await memberships.find({ connectionId, externalFleetId }, options(session)).sort({ vehicleId: 1 }).toArray()).map(toProviderFleetMembershipDomain); },
      async save(membership) { await atomicSave(memberships, { connectionId: membership.connectionId, externalFleetId: membership.externalFleetId, vehicleId: membership.vehicleId }, toProviderFleetMembershipDocument(membership, now()), session); },
    },
    grants: {
      async listByOrganizationId(organizationId) { return (await grants.find({ organizationId }, options(session)).sort({ vehicleId: 1 }).toArray()).map(toOrganizationVehicleAccessDomain); },
      async find(organizationId, vehicleId) { const document = await grants.findOne({ organizationId, vehicleId }, options(session)); return document ? toOrganizationVehicleAccessDomain(document) : undefined; },
      async save(grant) { await atomicSave(grants, { organizationId: grant.organizationId, vehicleId: grant.vehicleId }, toOrganizationVehicleAccessDocument(grant, now()), session); },
    },
    reviews: {
      async findById(id) { const document = await reviews.findOne({ id }, options(session)); return document ? toCatalogReviewDomain(document) : undefined; },
      async findByConnectionAndExternalId(connectionId, externalId) { const document = await reviews.findOne({ connectionId, externalId, status: "pending" }, options(session)); return document ? toCatalogReviewDomain(document) : undefined; },
      async listPending() { return (await reviews.find({ status: "pending" }, options(session)).sort({ id: 1 }).toArray()).map(toCatalogReviewDomain); },
      async save(review) { await atomicSave(reviews, { id: review.id }, toCatalogReviewDocument(review, now()), session); },
    },
  };
}



