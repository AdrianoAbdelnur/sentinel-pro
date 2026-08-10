import type { Db } from "mongodb";
import { catalogValidators } from "./catalog-validators.ts";

export const catalogIndexes = {
  companies: [{ key: { id: 1 }, options: { unique: true, name: "companies_id_unique" } }, { key: { organizationId: 1 }, options: { name: "companies_organization_lookup" } }],
  fleets: [{ key: { id: 1 }, options: { unique: true, name: "fleets_id_unique" } }, { key: { companyId: 1 }, options: { name: "fleets_company_lookup" } }, { key: { companyId: 1 }, options: { unique: true, partialFilterExpression: { kind: "unassigned" }, name: "fleets_unassigned_per_company_unique" } }],
  vehicles: [{ key: { id: 1 }, options: { unique: true, name: "vehicles_id_unique" } }, { key: { companyId: 1 }, options: { name: "vehicles_company_lookup" } }],
  company_candidates: [{ key: { organizationId: 1, connectionId: 1, normalizedLabel: 1 }, options: { unique: true, name: "company_candidates_tenant_connection_label_unique" } }, { key: { id: 1 }, options: { unique: true, name: "company_candidates_id_unique" } }],
  provider_connections: [{ key: { organizationId: 1, id: 1 }, options: { unique: true, name: "provider_connections_tenant_id_unique" } }],
  external_fleet_identities: [{ key: { id: 1 }, options: { unique: true, name: "external_fleet_identities_id_unique" } }, { key: { organizationId: 1, connectionId: 1, entityKind: 1, externalId: 1 }, options: { unique: true, name: "external_fleet_identities_tenant_connection_kind_external_unique" } }, { key: { organizationId: 1, fleetId: 1 }, options: { name: "external_fleet_identities_fleet_lookup" } }],
  external_vehicle_identities: [{ key: { id: 1 }, options: { unique: true, name: "external_vehicle_identities_id_unique" } }, { key: { organizationId: 1, connectionId: 1, entityKind: 1, externalId: 1 }, options: { unique: true, name: "external_vehicle_identities_tenant_connection_kind_external_unique" } }, { key: { organizationId: 1, connectionId: 1, lastSeenRunId: 1, presence: 1 }, options: { name: "external_vehicle_identities_presence_reconciliation" } }],
  catalog_reviews: [{ key: { id: 1 }, options: { unique: true, name: "catalog_reviews_id_unique" } }, { key: { organizationId: 1, status: 1 }, options: { name: "catalog_reviews_tenant_status_lookup" } }, { key: { organizationId: 1, connectionId: 1, subject: 1, externalId: 1 }, options: { name: "catalog_reviews_connection_subject_external_lookup" } }],
  capability_policies: [{ key: { id: 1 }, options: { unique: true, name: "capability_policies_id_unique" } }, { key: { organizationId: 1, scope: 1, scopeId: 1, capability: 1 }, options: { unique: true, name: "capability_policies_tenant_scope_capability_unique" } }],
  catalog_import_items: [{ key: { id: 1 }, options: { unique: true, name: "catalog_import_items_id_unique" } }, { key: { organizationId: 1, connectionId: 1, runId: 1, externalId: 1 }, options: { unique: true, name: "catalog_import_items_tenant_connection_run_external_unique" } }, { key: { organizationId: 1, connectionId: 1, runId: 1, status: 1, externalId: 1 }, options: { name: "catalog_import_items_run_pending_lookup" } }],
  catalog_import_runs: [{ key: { id: 1 }, options: { unique: true, name: "catalog_import_runs_id_unique" } }, { key: { organizationId: 1, connectionId: 1 }, options: { unique: true, partialFilterExpression: { status: "active" }, name: "catalog_import_runs_active_unique" } }, { key: { organizationId: 1, connectionId: 1, startedAt: -1 }, options: { name: "catalog_import_runs_latest_lookup" } }, { key: { organizationId: 1, connectionId: 1, status: 1, completedAt: -1 }, options: { name: "catalog_import_runs_last_success_lookup" } }],
  catalog_sync_leases: [{ key: { organizationId: 1, connectionId: 1 }, options: { unique: true, name: "catalog_sync_leases_tenant_connection_unique" } }, { key: { leaseUntil: 1 }, options: { expireAfterSeconds: 0, name: "catalog_sync_leases_ttl_cleanup" } }],
} as const;

export async function migrateCatalogDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(catalogValidators)) {
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(catalogIndexes)) await Promise.all(indexes.map(({ key, options }) => db.collection(name).createIndex(key, options)));
}
