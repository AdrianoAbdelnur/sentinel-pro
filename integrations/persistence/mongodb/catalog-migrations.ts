import type { Db } from "mongodb";
import { catalogValidators } from "./catalog-validators.ts";

export const catalogIndexes = {
  companies: [{ key: { id: 1 }, options: { unique: true, name: "companies_id_unique" } }, { key: { organizationId: 1 }, options: { name: "companies_organization_lookup" } }],
  fleets: [{ key: { id: 1 }, options: { unique: true, name: "fleets_id_unique" } }, { key: { companyId: 1 }, options: { name: "fleets_company_lookup" } }, { key: { companyId: 1 }, options: { unique: true, partialFilterExpression: { kind: "unassigned" }, name: "fleets_unassigned_per_company_unique" } }],
  vehicles: [{ key: { id: 1 }, options: { unique: true, name: "vehicles_id_unique" } }, { key: { companyId: 1 }, options: { name: "vehicles_company_lookup" } }],
  company_candidates: [{ key: { organizationId: 1, connectionId: 1, normalizedLabel: 1 }, options: { unique: true, name: "company_candidates_tenant_connection_label_unique" } }, { key: { id: 1 }, options: { unique: true, name: "company_candidates_id_unique" } }],
  provider_connections: [{ key: { organizationId: 1, id: 1 }, options: { unique: true, name: "provider_connections_tenant_id_unique" } }],
} as const;

export async function migrateCatalogDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(catalogValidators)) {
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(catalogIndexes)) await Promise.all(indexes.map(({ key, options }) => db.collection(name).createIndex(key, options)));
}
