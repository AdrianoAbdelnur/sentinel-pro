import type { Document } from "mongodb";

const objectId = { bsonType: "objectId" };
const version = { bsonType: "int" };
const date = { bsonType: "date" };
const text = { bsonType: "string" };

export const identityValidators: Record<string, Document> = {
  users: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "firstName", "lastName", "emailNormalized", "passwordHash", "passwordChangeRequired", "status", "failureCount", "authorizationVersion", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, firstName: text, lastName: text, emailNormalized: text, passwordHash: text, passwordChangeRequired: { bsonType: "bool" }, status: { enum: ["active", "inactive"] }, failureCount: version, failureWindowStartedAt: date, blockedUntil: date, authorizationVersion: version, platformRole: { enum: ["super-admin"] }, createdAt: date, updatedAt: date } } },
  organizations: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "name", "seedKey", "status", "authorizationVersion", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, id: text, name: text, seedKey: text, status: { enum: ["active", "inactive"] }, authorizationVersion: version, createdAt: date, updatedAt: date } } },
  organization_memberships: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "organizationId", "userId", "role", "status", "createdAt", "updatedAt"], properties: { _id: objectId, schemaVersion: version, organizationId: text, userId: text, role: { enum: ["admin", "operator"] }, status: { enum: ["active", "inactive"] }, createdAt: date, updatedAt: date } } },
  sessions: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "tokenHash", "userId", "lastActivityAt", "expiresAt", "createdAt"], properties: { _id: objectId, schemaVersion: version, id: text, tokenHash: text, userId: text, activeOrganizationId: text, lastActivityAt: date, expiresAt: date, revokedAt: date, createdAt: date } } },
};
