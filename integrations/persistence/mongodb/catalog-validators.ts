import type { Document } from "mongodb";

const objectId = { bsonType: "objectId" };
const version = { bsonType: "int" };
const date = { bsonType: "date" };
const text = { bsonType: "string" };

export const catalogValidators: Record<string, Document> = {
  companies: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "organizationId", "name", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, organizationId: text, name: text, createdAt: date, updatedAt: date } } },
  fleets: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "companyId", "name", "kind", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, companyId: text, name: text, kind: { enum: ["standard", "unassigned"] }, createdAt: date, updatedAt: date } } },
  vehicles: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "companyId", "origin", "placement", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, companyId: text, origin: { enum: ["native", "provider"] }, placement: { bsonType: "object", additionalProperties: false, required: ["fleetId", "source"], properties: { fleetId: text, source: { enum: ["system", "admin"] } } }, label: text, plate: text, internalCode: text, createdAt: date, updatedAt: date } } },
  company_candidates: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "organizationId", "connectionId", "normalizedLabel", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, organizationId: text, connectionId: text, normalizedLabel: text, companyId: text, createdAt: date, updatedAt: date } } },
  provider_connections: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "organizationId", "credentialRef", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, organizationId: text, credentialRef: text, createdAt: date, updatedAt: date } } },
};
