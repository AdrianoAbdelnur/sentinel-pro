import type { ClientSession, Collection, Db, Filter, UpdateFilter } from "mongodb";
import type { GlobalCatalogRepositories } from "@/application/catalog-global/ports";
import { createGlobalCapabilityPolicy, type GlobalCapabilityPolicy, type GlobalVehicle, type SentinelGroup } from "@/domain/catalog-global";
import {
  toGlobalCatalogReviewDocument, toGlobalCatalogReviewDomain, toGlobalVehicleDocument, toGlobalVehicleDomain,
  toProviderConnectionDocument, toProviderConnectionDomain, toProviderContributionDocument, toProviderContributionDomain,
  toProviderDefinitionDocument, toProviderDefinitionDomain, toProviderFleetMembershipDocument, toProviderFleetMembershipDomain,
  toTenantVehicleGrantDocument, toTenantVehicleGrantDomain,
  toSentinelGroupDocument, toSentinelGroupDomain, toGroupEvidenceBindingDocument, toGroupEvidenceBindingDomain,
  type GlobalCatalogReviewDocument, type GlobalVehicleDocument, type ProviderConnectionDocument, type ProviderContributionDocument,
  type ProviderDefinitionDocument, type ProviderFleetMembershipDocument, type TenantVehicleGrantDocument,
  type SentinelGroupDocument, type GroupEvidenceBindingDocument,
} from "./catalog-global-documents";
import { createGlobalSyncRepositories } from "./catalog-global-sync-repositories";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();
const atomicSave = async <T extends { schemaVersion: number; createdAt: Date; updatedAt: Date }>(collection: Collection<T>, filter: Filter<T>, document: T, session?: ClientSession) => {
  const { schemaVersion, createdAt, ...mutable } = document;
  await collection.updateOne(filter, { $set: mutable, $setOnInsert: { schemaVersion, createdAt } } as UpdateFilter<T>, { upsert: true, ...options(session) });
};

type GlobalCatalogLiveReadRepositories = {
  groups: GlobalCatalogRepositories["groups"] & { list(): Promise<SentinelGroup[]> };
  vehicles: GlobalCatalogRepositories["vehicles"] & { list(): Promise<GlobalVehicle[]> };
  policies: { list(): Promise<GlobalCapabilityPolicy[]> };
};

type CapabilityPolicyDocument = {
  id: string;
  capability: string;
  sourceOrder: string[];
};

export function createGlobalCatalogRepositories(db: Db, session?: ClientSession): GlobalCatalogRepositories & GlobalCatalogLiveReadRepositories & ReturnType<typeof createGlobalSyncRepositories> {
  const vehicles = db.collection<GlobalVehicleDocument>("global_vehicles_v2");
  const providers = db.collection<ProviderDefinitionDocument>("provider_definitions_v2");
  const connections = db.collection<ProviderConnectionDocument>("provider_connections_v2");
  const contributions = db.collection<ProviderContributionDocument>("provider_contributions_v2");
  const memberships = db.collection<ProviderFleetMembershipDocument>("provider_fleet_memberships_v2");
  const grants = db.collection<TenantVehicleGrantDocument>("tenant_vehicle_grants_v2");
  const reviews = db.collection<GlobalCatalogReviewDocument>("catalog_reviews_v2");
  const groups = db.collection<SentinelGroupDocument>("sentinel_groups_v2");
  const evidenceBindings = db.collection<GroupEvidenceBindingDocument>("group_evidence_bindings_v2");
  const policies = db.collection<CapabilityPolicyDocument>("capability_policies_v2");

  return {
    ...createGlobalSyncRepositories(db, session),
    policies: {
      async list() {
        return (await policies.find({}, options(session)).sort({ id: 1 }).toArray())
          .map(({ id, capability, sourceOrder }) => createGlobalCapabilityPolicy({ id, capability, sourceOrder }));
      },
    },
    groups: {
      async list() { return (await groups.find({}, options(session)).sort({ id: 1 }).toArray()).map(toSentinelGroupDomain); },
      async findById(id) { const document = await groups.findOne({ id }, options(session)); return document ? toSentinelGroupDomain(document) : undefined; },
      async findByLabel(label) { return (await groups.find({ label }, options(session)).sort({ id: 1 }).toArray()).map(toSentinelGroupDomain); },
      async save(group) { await atomicSave(groups, { id: group.id }, toSentinelGroupDocument(group, now()), session); },
    },
    evidenceBindings: {
      async findById(id) { const document = await evidenceBindings.findOne({ id }, options(session)); return document ? toGroupEvidenceBindingDomain(document) : undefined; },
      async findByGroupId(groupId) { return (await evidenceBindings.find({ groupId }, options(session)).sort({ id: 1 }).toArray()).map(toGroupEvidenceBindingDomain); },
      async findByEvidence(connectionId, kind, externalKey) { return (await evidenceBindings.find({ "evidence.connectionId": connectionId, "evidence.kind": kind, "evidence.externalKey": externalKey }, options(session)).sort({ id: 1 }).toArray()).map(toGroupEvidenceBindingDomain); },
      async save(binding) { await atomicSave(evidenceBindings, { id: binding.id }, toGroupEvidenceBindingDocument(binding, now()), session); },
    },
    vehicles: {
      async list() { return (await vehicles.find({}, options(session)).sort({ id: 1 }).toArray()).map(toGlobalVehicleDomain); },
      async findById(id) { const document = await vehicles.findOne({ id }, options(session)); return document ? toGlobalVehicleDomain(document) : undefined; },
      async findByNormalizedPlate(normalizedPlate) { const document = await vehicles.findOne({ normalizedPlate }, options(session)); return document ? toGlobalVehicleDomain(document) : undefined; },
      async save(vehicle) { await atomicSave(vehicles, { id: vehicle.id }, toGlobalVehicleDocument(vehicle, now()), session); },
    },
    providers: {
      async findById(id) { const document = await providers.findOne({ id }, options(session)); return document ? toProviderDefinitionDomain(document) : undefined; },
      async findByAdapterKey(adapterKey) { const document = await providers.findOne({ adapterKey }, options(session)); return document ? toProviderDefinitionDomain(document) : undefined; },
      async list() { return (await providers.find({}, options(session)).sort({ id: 1 }).toArray()).map(toProviderDefinitionDomain); },
      async save(provider) { await atomicSave(providers, { id: provider.id }, toProviderDefinitionDocument(provider, now()), session); },
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
      async listByOrganizationId(organizationId) { return (await grants.find({ organizationId }, options(session)).sort({ vehicleId: 1 }).toArray()).map(toTenantVehicleGrantDomain); },
      async find(organizationId, vehicleId) { const document = await grants.findOne({ organizationId, vehicleId }, options(session)); return document ? toTenantVehicleGrantDomain(document) : undefined; },
      async save(grant) { await atomicSave(grants, { organizationId: grant.organizationId, vehicleId: grant.vehicleId }, toTenantVehicleGrantDocument(grant, now()), session); },
    },
    reviews: {
      async findById(id) { const document = await reviews.findOne({ id }, options(session)); return document ? toGlobalCatalogReviewDomain(document) : undefined; },
      async findByConnectionAndExternalId(connectionId, externalId) { const document = await reviews.findOne({ connectionId, externalId, status: "pending" }, options(session)); return document ? toGlobalCatalogReviewDomain(document) : undefined; },
      async listPending() { return (await reviews.find({ status: "pending" }, options(session)).sort({ id: 1 }).toArray()).map(toGlobalCatalogReviewDomain); },
      async save(review) { await atomicSave(reviews, { id: review.id }, toGlobalCatalogReviewDocument(review, now()), session); },
    },
  };
}



