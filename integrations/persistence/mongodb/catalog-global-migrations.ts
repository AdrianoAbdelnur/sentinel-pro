import type { Db } from "mongodb";
import { createGroupEvidenceBinding, createSentinelGroup, createVehiclePlacement } from "@/domain/catalog-global";
import { catalogGlobalValidators } from "./catalog-global-validators";

export const globalCatalogCollectionNames = Object.keys(catalogGlobalValidators);
type LegacyVehicleDocument = { _id: unknown; id: string; placementFleetId: string; placement?: unknown };
type LegacyFleetDocument = { id: string; label: string };
type ReviewDocument = Record<string, unknown>;
const unique = (key: Record<string, 1 | -1>, name: string) => ({ key, options: { unique: true, name } });
export const globalCatalogIndexes = {
  global_vehicles_v2: [unique({ id: 1 }, "global_vehicles_v2_id_unique"), unique({ normalizedPlate: 1 }, "global_vehicles_v2_plate_unique")],
  sentinel_groups_v2: [unique({ id: 1 }, "sentinel_groups_v2_id_unique")],
  group_evidence_bindings_v2: [unique({ id: 1 }, "group_evidence_bindings_v2_id_unique"), unique({ "evidence.connectionId": 1, "evidence.kind": 1, "evidence.externalKey": 1 }, "group_evidence_bindings_v2_evidence_unique"), { key: { groupId: 1 }, options: { name: "group_evidence_bindings_v2_group_lookup" } }],
  sentinel_fleets_v2: [unique({ id: 1 }, "sentinel_fleets_v2_id_unique")],
  provider_definitions_v2: [unique({ id: 1 }, "provider_definitions_v2_id_unique"), unique({ adapterKey: 1 }, "provider_definitions_v2_adapter_unique")],
  provider_connections_v2: [unique({ id: 1 }, "provider_connections_v2_id_unique"), { key: { providerId: 1, enabled: 1 }, options: { name: "provider_connections_v2_enabled_lookup" } }],
  provider_contributions_v2: [unique({ id: 1 }, "provider_contributions_v2_id_unique"), unique({ connectionId: 1, externalId: 1 }, "provider_contributions_v2_connection_external_unique"), { key: { vehicleId: 1 }, options: { name: "provider_contributions_v2_vehicle_lookup" } }, { key: { presence: 1 }, options: { name: "provider_contributions_v2_presence_lookup" } }],
  provider_fleet_memberships_v2: [unique({ connectionId: 1, externalFleetId: 1, vehicleId: 1 }, "provider_fleet_memberships_v2_identity_unique"), { key: { vehicleId: 1 }, options: { name: "provider_fleet_memberships_v2_vehicle_lookup" } }],
  capability_policies_v2: [unique({ id: 1 }, "capability_policies_v2_id_unique"), unique({ scope: 1, scopeId: 1, capability: 1 }, "capability_policies_v2_scope_capability_unique")],
  tenant_vehicle_grants_v2: [unique({ organizationId: 1, vehicleId: 1 }, "tenant_vehicle_grants_v2_organization_vehicle_unique")],
  catalog_reviews_v2: [unique({ id: 1 }, "catalog_reviews_v2_id_unique"), { key: { status: 1 }, options: { name: "catalog_reviews_v2_status_lookup" } }, unique({ connectionId: 1, externalId: 1 }, "catalog_reviews_v2_connection_external_unique")],
  catalog_runs_v2: [unique({ id: 1 }, "catalog_runs_v2_id_unique"), { key: { connectionId: 1, startedAt: -1 }, options: { name: "catalog_runs_v2_latest_lookup" } }],
  catalog_import_items_v2: [unique({ id: 1 }, "catalog_import_items_v2_id_unique"), unique({ connectionId: 1, runId: 1, externalId: 1 }, "catalog_import_items_v2_run_external_unique")],
  catalog_leases_v2: [unique({ connectionId: 1 }, "catalog_leases_v2_connection_unique"), { key: { leaseUntil: 1 }, options: { expireAfterSeconds: 0, name: "catalog_leases_v2_ttl" } }],
} as const;

export async function migrateGlobalCatalogDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const name of globalCatalogCollectionNames) {
    const validator = catalogGlobalValidators[name];
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(globalCatalogIndexes)) for (const { key, options } of indexes) await db.collection(name).createIndex(key, options);
}

export async function rollbackGlobalCatalogDatabase(db: Db) {
  const populated = [];
  for (const name of globalCatalogCollectionNames) if (await db.collection(name).countDocuments() > 0) populated.push(name);
  if (populated.length > 0) throw new Error(`Cannot rollback non-empty v2 collections: ${populated.join(", ")}`);
  for (const name of globalCatalogCollectionNames) if ((await db.listCollections({ name }).hasNext())) await db.collection(name).drop();
}

export async function backfillLegacyUnverifiedPlacements(db: Db, now = new Date()): Promise<{ migrated: number; reviewed: number }> {
  const vehicles = db.collection<LegacyVehicleDocument>("global_vehicles_v2"); const fleets = db.collection<LegacyFleetDocument>("sentinel_fleets_v2"); const reviews = db.collection<ReviewDocument>("catalog_reviews_v2");
  let migrated = 0; let reviewed = 0;
  for await (const vehicle of vehicles.find({ placement: { $exists: false }, placementFleetId: { $type: "string" } })) {
    const fleet = await fleets.findOne({ id: vehicle.placementFleetId });
    if (!fleet) { await reviews.updateOne({ id: `legacy-placement:${vehicle.id}` }, { $set: { schemaVersion: 2, id: `legacy-placement:${vehicle.id}`, connectionId: "legacy", externalId: vehicle.id, subject: "vehicle-identity", reason: "missing-placement", candidateVehicleIds: [vehicle.id], status: "pending", updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); reviewed += 1; continue; }
    const group = createSentinelGroup({ id: fleet.id, label: fleet.label }); await db.collection("sentinel_groups_v2").updateOne({ id: group.id }, { $set: { schemaVersion: 2, id: group.id, label: group.label, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    const binding = createGroupEvidenceBinding({ id: `legacy:${fleet.id}`, groupId: group.id, evidence: { connectionId: "legacy", kind: "fleet-membership", externalKey: fleet.id, label: fleet.label, authority: "fallback" } }); await db.collection("group_evidence_bindings_v2").updateOne({ id: binding.id }, { $set: { schemaVersion: 2, groupId: binding.groupId, evidence: binding.evidence, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    await vehicles.updateOne({ _id: vehicle._id }, { $set: { placement: createVehiclePlacement({ groupId: group.id, authority: "legacy-unverified", evidenceBindingId: binding.id, assignedAt: now }), updatedAt: now } }); migrated += 1;
  }
  return { migrated, reviewed };
}
