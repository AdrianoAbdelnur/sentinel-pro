import type { Db } from "mongodb";
import { catalogValidators } from "./catalog-validators";

export const catalogCollectionNames = Object.keys(catalogValidators);
const unique = (key: Record<string, 1 | -1>, name: string) => ({ key, options: { unique: true, name } });
export const catalogIndexes = {
  catalog_vehicles: [unique({ id: 1 }, "catalog_vehicles_id_unique"), unique({ normalizedPlate: 1 }, "catalog_vehicles_plate_unique")],
  catalog_groups: [unique({ id: 1 }, "catalog_groups_id_unique")],
  group_evidence_bindings: [unique({ id: 1 }, "group_evidence_bindings_id_unique"), unique({ "evidence.connectionId": 1, "evidence.kind": 1, "evidence.externalKey": 1 }, "group_evidence_bindings_evidence_unique"), { key: { groupId: 1 }, options: { name: "group_evidence_bindings_group_lookup" } }],
  providers: [unique({ id: 1 }, "providers_id_unique"), unique({ adapterKey: 1 }, "providers_adapter_unique")],
  provider_connections: [unique({ id: 1 }, "provider_connections_id_unique"), { key: { providerId: 1, enabled: 1 }, options: { name: "provider_connections_enabled_lookup" } }, { key: { providerId: 1 }, options: { unique: true, partialFilterExpression: { enabled: true }, name: "provider_connections_one_enabled_unique" } }],
  provider_contributions: [unique({ id: 1 }, "provider_contributions_id_unique"), unique({ connectionId: 1, externalId: 1 }, "provider_contributions_connection_external_unique"), { key: { vehicleId: 1 }, options: { name: "provider_contributions_vehicle_lookup" } }, { key: { presence: 1 }, options: { name: "provider_contributions_presence_lookup" } }],
  provider_fleet_memberships: [unique({ connectionId: 1, externalFleetId: 1, vehicleId: 1 }, "provider_fleet_memberships_identity_unique"), { key: { vehicleId: 1 }, options: { name: "provider_fleet_memberships_vehicle_lookup" } }],
  capability_policies: [unique({ id: 1 }, "capability_policies_id_unique"), unique({ capability: 1 }, "capability_policies_capability_unique")],
  organization_vehicle_access: [unique({ organizationId: 1, vehicleId: 1 }, "organization_vehicle_access_organization_vehicle_unique")],
  catalog_reviews: [unique({ id: 1 }, "catalog_reviews_id_unique"), { key: { status: 1 }, options: { name: "catalog_reviews_status_lookup" } }, unique({ connectionId: 1, externalId: 1 }, "catalog_reviews_connection_external_unique")],
  catalog_runs: [unique({ id: 1 }, "catalog_runs_id_unique"), { key: { connectionId: 1, startedAt: -1 }, options: { name: "catalog_runs_latest_lookup" } }],
  catalog_leases: [unique({ connectionId: 1 }, "catalog_leases_connection_unique"), { key: { leaseUntil: 1 }, options: { expireAfterSeconds: 0, name: "catalog_leases_ttl" } }],
} as const;

export async function initializeCatalogDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const name of catalogCollectionNames) {
    const validator = catalogValidators[name];
    if (!existing.has(name)) await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(catalogIndexes)) for (const { key, options } of indexes) await db.collection(name).createIndex(key, options);
}
