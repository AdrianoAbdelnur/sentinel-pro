import type { Document } from "mongodb";

const objectId = { bsonType: "objectId" };
const version = { bsonType: "int" };
const date = { bsonType: "date" };
const text = { bsonType: "string", minLength: 1 };
const status = { enum: ["eligible", "absent", "unsupported", "stale", "unavailable"] };
const timestamps = { createdAt: date, updatedAt: date };
const schema = (required: string[], properties: Document): Document => ({ $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", ...required, "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, ...properties, ...timestamps } } });

export const catalogGlobalValidators: Record<string, Document> = {
  global_vehicles_v2: schema(["id", "normalizedPlate", "plate", "placementFleetId"], { id: text, normalizedPlate: text, plate: text, placementFleetId: text }),
  sentinel_fleets_v2: schema(["id", "label"], { id: text, label: text }),
  provider_definitions_v2: schema(["id", "adapterKey", "capabilities"], { id: text, adapterKey: text, capabilities: { bsonType: "array", uniqueItems: true, items: text } }),
  provider_connections_v2: schema(["id", "providerId", "credentialRef", "enabled", "cadenceMinutes"], { id: text, providerId: text, credentialRef: text, enabled: { bsonType: "bool" }, cadenceMinutes: { bsonType: "int", minimum: 1 } }),
  provider_contributions_v2: schema(["id", "connectionId", "externalId", "vehicleId", "capabilities", "presence"], { id: text, connectionId: text, externalId: text, vehicleId: text, capabilities: { bsonType: "object", additionalProperties: status }, presence: { enum: ["present", "absent"] } }),
  provider_fleet_memberships_v2: schema(["connectionId", "externalFleetId", "vehicleId", "label"], { connectionId: text, externalFleetId: text, vehicleId: text, label: text }),
  capability_policies_v2: schema(["id", "scope", "scopeId", "capability", "sourceOrder"], { id: text, scope: { enum: ["vehicle", "fleet", "organization"] }, scopeId: text, capability: text, sourceOrder: { bsonType: "array", items: text } }),
  tenant_vehicle_grants_v2: schema(["organizationId", "vehicleId"], { organizationId: text, vehicleId: text }),
  catalog_reviews_v2: schema(["id", "connectionId", "externalId", "subject", "reason", "candidateVehicleIds", "status"], { id: text, connectionId: text, externalId: text, subject: { enum: ["vehicle-identity"] }, reason: { enum: ["missing-plate", "malformed-plate", "ambiguous-match", "conflicting-identity"] }, normalizedPlate: text, candidateVehicleIds: { bsonType: "array", maxItems: 20, items: text }, status: { enum: ["pending", "resolved"] }, resolvedVehicleId: text }),
  catalog_runs_v2: schema(["id", "connectionId", "status", "startedAt"], { id: text, connectionId: text, status: { enum: ["active", "succeeded", "failed"] }, startedAt: date, completedAt: date }),
  catalog_import_items_v2: schema(["id", "connectionId", "runId", "externalId", "status"], { id: text, connectionId: text, runId: text, externalId: text, status: { enum: ["pending", "processed"] }, outcome: { enum: ["created", "linked", "reviewed", "rejected"] } }),
  catalog_leases_v2: schema(["connectionId", "runId", "leaseUntil"], { connectionId: text, runId: text, leaseUntil: date }),
};
