import type { Db } from "mongodb";
import { catalogGlobalValidators } from "./catalog-global-validators";

export const globalCatalogCollectionNames = Object.keys(catalogGlobalValidators);
const unique = (key: Record<string, 1 | -1>, name: string) => ({ key, options: { unique: true, name } });
export const globalCatalogIndexes = {
  global_vehicles_v2: [unique({ id: 1 }, "global_vehicles_v2_id_unique"), unique({ normalizedPlate: 1 }, "global_vehicles_v2_plate_unique")],
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
