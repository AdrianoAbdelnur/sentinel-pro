import type { Document } from "mongodb";

const objectId = { bsonType: "objectId" };
const version = { bsonType: "int" };
const date = { bsonType: "date" };
const text = { bsonType: "string", minLength: 1 };
const status = { enum: ["eligible", "absent", "unsupported", "stale", "unavailable"] };
const timestamps = { createdAt: date, updatedAt: date };
const schema = (required: string[], properties: Document): Document => ({ $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", ...required, "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, ...properties, ...timestamps } } });

export const catalogValidators: Record<string, Document> = {
  catalog_vehicles: schema(["id", "normalizedPlate", "plate", "placementFleetId"], { id: text, normalizedPlate: text, plate: text, placementFleetId: text, placement: { bsonType: "object", required: ["groupId", "authority", "assignedAt"], properties: { groupId: text, authority: { enum: ["authoritative", "fallback"] }, evidenceBindingId: text, assignedAt: date } } }),
  catalog_groups: schema(["id", "label", "normalizedLabel"], { id: text, label: text, normalizedLabel: text }),
  group_evidence_bindings: schema(["id", "groupId", "evidence"], { id: text, groupId: text, evidence: { bsonType: "object", required: ["connectionId", "kind", "externalKey", "label", "authority"], properties: { connectionId: text, kind: { enum: ["company-label", "fleet-membership"] }, externalKey: text, label: text, authority: { enum: ["authoritative", "fallback"] } } } }),
  providers: schema(["id", "adapterKey", "capabilities"], { id: text, adapterKey: text, capabilities: { bsonType: "array", uniqueItems: true, items: text } }),
  provider_connections: schema(["id", "providerId", "credentialRef", "enabled", "cadenceMinutes"], { id: text, providerId: text, credentialRef: text, enabled: { bsonType: "bool" }, cadenceMinutes: { bsonType: "int", minimum: 1 } }),
  provider_contributions: schema(["id", "connectionId", "externalId", "vehicleId", "capabilities", "presence"], { id: text, connectionId: text, externalId: text, vehicleId: text, capabilities: { bsonType: "object", additionalProperties: status }, presence: { enum: ["present", "absent"] } }),
  provider_fleet_memberships: schema(["connectionId", "externalFleetId", "vehicleId", "label"], { connectionId: text, externalFleetId: text, vehicleId: text, label: text }),
  capability_policies: schema(["id", "capability", "sourceOrder"], { id: text, capability: text, sourceOrder: { bsonType: "array", items: text } }),
  organization_vehicle_access: schema(["organizationId", "vehicleId"], { organizationId: text, vehicleId: text }),
  catalog_reviews: schema(["id", "connectionId", "externalId", "subject", "reason", "candidateVehicleIds", "status"], { id: text, connectionId: text, externalId: text, subject: { enum: ["vehicle-identity"] }, reason: { enum: ["missing-plate", "malformed-plate", "missing-placement", "ambiguous-match", "conflicting-identity", "ambiguous-group-evidence"] }, normalizedPlate: text, evidenceKey: text, candidateGroupIds: { bsonType: "array", maxItems: 20, items: text }, candidateVehicleIds: { bsonType: "array", maxItems: 20, items: text }, status: { enum: ["pending", "resolved"] }, resolvedVehicleId: text }),
  catalog_runs: schema(["id", "lineageId", "attempt", "connectionId", "status", "trigger", "startedAt", "total", "counts", "snapshot"], { id: text, lineageId: text, attempt: { bsonType: "int", minimum: 1 }, connectionId: text, status: { enum: ["active", "succeeded", "failed"] }, trigger: { enum: ["initial", "manual", "internal", "scheduler"] }, startedAt: date, completedAt: date, checkpoint: text, total: { bsonType: "int", minimum: 0 }, counts: { bsonType: "object" }, snapshot: { bsonType: "object" }, failure: { bsonType: "object" } }),
  catalog_leases: schema(["connectionId", "runId", "leaseUntil"], { connectionId: text, runId: text, leaseUntil: date }),
};
