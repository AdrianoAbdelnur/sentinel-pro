import { randomUUID } from "node:crypto";
import { Argon2idPasswordHasher } from "@/integrations/security";
import { createIdentityApplication } from "@/application/identity";
import { getMongoClient, getMongoDatabase } from "./client";
import { migrateIdentityDatabase } from "./migrations";
import { createMongoIdentityRepositories } from "./repositories";
import { MongoTransactionRunner } from "./transaction-runner";

export async function runInitialIdentitySeed() {
  const organizationName = process.env.SENTINEL_INITIAL_ORGANIZATION_NAME;
  const administratorEmail = process.env.SENTINEL_INITIAL_ADMIN_EMAIL;
  const administratorPassword = process.env.SENTINEL_INITIAL_ADMIN_PASSWORD;
  if (!organizationName || !administratorEmail || !administratorPassword) throw new Error("Initial identity seed environment variables are required");
  const client = await getMongoClient();
  const db = await getMongoDatabase();
  await migrateIdentityDatabase(db);
  const passwords = new Argon2idPasswordHasher();
  const repositories = createMongoIdentityRepositories(db, client);
  return createIdentityApplication({ ...repositories, passwords, dummyPasswordHash: await passwords.hash("sentinel-invalid-credential"), tokens: { create: async () => "" }, tokenHasher: { hash: async () => "" }, temporaryPasswords: { create: () => "" }, ids: { create: randomUUID }, clock: { now: () => new Date() }, transactions: new MongoTransactionRunner(client, db) }).seed({ organizationId: "initial", organizationName, administrator: { id: "initial-admin", firstName: process.env.SENTINEL_INITIAL_ADMIN_FIRST_NAME ?? "Administrator", lastName: process.env.SENTINEL_INITIAL_ADMIN_LAST_NAME ?? "Sentinel", email: administratorEmail, passwordHash: await passwords.hash(administratorPassword), platformRole: "super-admin" } });
}

if (require.main === module) runInitialIdentitySeed().then(() => process.exit(0)).catch(() => process.exit(1));
