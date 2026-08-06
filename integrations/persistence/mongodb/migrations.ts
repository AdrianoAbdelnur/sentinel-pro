import type { Db } from "mongodb";
import { identityValidators } from "./validators.ts";

export const identityIndexes = {
  users: [{ key: { emailNormalized: 1 }, options: { unique: true, name: "users_email_normalized_unique" } }],
  organizations: [{ key: { seedKey: 1 }, options: { unique: true, name: "organizations_seed_key_unique" } }, { key: { authorizationVersion: 1 }, options: { name: "organizations_authorization_version" } }],
  organization_memberships: [{ key: { organizationId: 1, userId: 1 }, options: { unique: true, name: "memberships_organization_user_unique" } }, { key: { userId: 1 }, options: { name: "memberships_user_lookup" } }, { key: { organizationId: 1, status: 1, role: 1 }, options: { name: "memberships_organization_status_role_lookup" } }],
  sessions: [{ key: { tokenHash: 1 }, options: { unique: true, name: "sessions_token_hash_unique" } }, { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "sessions_expiry_ttl" } }, { key: { userId: 1, activeOrganizationId: 1, revokedAt: 1 }, options: { name: "sessions_user_tenant_revocation_lookup" } }],
} as const;

export async function migrateIdentityDatabase(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(identityValidators)) {
    if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [name, indexes] of Object.entries(identityIndexes)) await Promise.all(indexes.map(({ key, options }) => db.collection(name).createIndex(key, options)));
}
