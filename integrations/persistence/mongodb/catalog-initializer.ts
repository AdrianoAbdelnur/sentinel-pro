import type { Db } from "mongodb";
import { catalogValidators } from "./catalog-validators";

export const catalogCollectionNames = Object.keys(catalogValidators);
const unique = (key: Record<string, 1 | -1>, name: string) => ({ key, options: { unique: true, name } });
export const catalogIndexes = {
  catalog_vehicles: [unique({ id: 1 }, "catalog_vehicles_id_unique"), { key: { normalizedPlate: 1 }, options: { unique: true, sparse: true, name: "catalog_vehicles_plate_unique" } }],
  catalog_groups: [unique({ id: 1 }, "catalog_groups_id_unique"), { key: { normalizedLabel: 1 }, options: { name: "catalog_groups_normalized_label_lookup" } }],
  group_evidence_bindings: [unique({ id: 1 }, "group_evidence_bindings_id_unique"), unique({ "evidence.connectionId": 1, "evidence.kind": 1, "evidence.externalKey": 1 }, "group_evidence_bindings_evidence_unique"), { key: { groupId: 1 }, options: { name: "group_evidence_bindings_group_lookup" } }],
  providers: [unique({ id: 1 }, "providers_id_unique"), unique({ adapterKey: 1 }, "providers_adapter_unique")],
  provider_connections: [unique({ id: 1 }, "provider_connections_id_unique"), { key: { providerId: 1, enabled: 1 }, options: { name: "provider_connections_enabled_lookup" } }, { key: { providerId: 1 }, options: { unique: true, partialFilterExpression: { enabled: true }, name: "provider_connections_one_enabled_unique" } }],
  provider_contributions: [unique({ id: 1 }, "provider_contributions_id_unique"), unique({ connectionId: 1, externalId: 1 }, "provider_contributions_connection_external_unique"), { key: { vehicleId: 1 }, options: { name: "provider_contributions_vehicle_lookup" } }, { key: { presence: 1 }, options: { name: "provider_contributions_presence_lookup" } }],
  catalog_devices: [unique({ id: 1 }, "catalog_devices_id_unique"), unique({ connectionId: 1, deviceId: 1 }, "catalog_devices_connection_device_unique"), { key: { vehicleId: 1 }, options: { name: "catalog_devices_vehicle_lookup" } }],
  provider_vehicle_observations: [unique({ id: 1 }, "provider_vehicle_observations_id_unique"), unique({ contributionId: 1 }, "provider_vehicle_observations_contribution_unique")],
  catalog_conflicts: [unique({ id: 1 }, "catalog_conflicts_id_unique"), { key: { vehicleId: 1, kind: 1, status: 1 }, options: { name: "catalog_conflicts_vehicle_kind_status_lookup" } }],
  provider_fleet_memberships: [unique({ connectionId: 1, externalFleetId: 1, vehicleId: 1 }, "provider_fleet_memberships_identity_unique"), { key: { vehicleId: 1 }, options: { name: "provider_fleet_memberships_vehicle_lookup" } }],
  capability_policies: [unique({ id: 1 }, "capability_policies_id_unique"), unique({ capability: 1 }, "capability_policies_capability_unique")],
  organization_vehicle_access: [unique({ organizationId: 1, vehicleId: 1 }, "organization_vehicle_access_organization_vehicle_unique"), { key: { vehicleId: 1 }, options: { name: "organization_vehicle_access_vehicle_lookup" } }],
  catalog_reviews: [unique({ id: 1 }, "catalog_reviews_id_unique"), { key: { status: 1 }, options: { name: "catalog_reviews_status_lookup" } }, unique({ connectionId: 1, externalId: 1 }, "catalog_reviews_connection_external_unique"), { key: { connectionId: 1, externalId: 1, status: 1 }, options: { name: "catalog_reviews_connection_external_status_lookup" } }],
  catalog_runs: [unique({ id: 1 }, "catalog_runs_id_unique"), { key: { connectionId: 1, startedAt: -1 }, options: { name: "catalog_runs_latest_lookup" } }],
  catalog_leases: [unique({ connectionId: 1 }, "catalog_leases_connection_unique"), { key: { leaseUntil: 1 }, options: { expireAfterSeconds: 0, name: "catalog_leases_ttl" } }],
} as const;

function sameIndexDefinition(existing: Record<string, unknown>, desired: { key: Record<string, 1 | -1>; options: Record<string, unknown> }): boolean {
  return JSON.stringify(existing.key) === JSON.stringify(desired.key)
    && existing.unique === desired.options.unique
    && existing.sparse === desired.options.sparse
    && existing.expireAfterSeconds === desired.options.expireAfterSeconds
    && JSON.stringify(existing.partialFilterExpression) === JSON.stringify(desired.options.partialFilterExpression);
}

export async function initializeCatalogDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const name of catalogCollectionNames) {
    const validator = catalogValidators[name];
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(catalogIndexes)) {
    const collection = db.collection(name);
    const currentIndexes = await collection.listIndexes().toArray();
    for (const desired of indexes) {
      const existingIndex = currentIndexes.find((index) => index.name === desired.options.name);
      if (existingIndex && !sameIndexDefinition(existingIndex, desired)) await collection.dropIndex(desired.options.name);
      await collection.createIndex(desired.key, desired.options);
    }
  }
}
