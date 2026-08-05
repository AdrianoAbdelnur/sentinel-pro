import { createIdentityApplication, type IdentityApplicationPorts } from "@/application/identity";
import { createMongoIdentityRepositories, getMongoClient, getMongoDatabase, MongoTransactionRunner } from "@/integrations/persistence/mongodb";
import { Argon2idPasswordHasher, createDummyPasswordHash, ReadableTemporaryPasswordGenerator, SecureOpaqueTokenGenerator, SHA256TokenHasher } from "@/integrations/security";
import { randomUUID } from "node:crypto";

let application: ReturnType<typeof createIdentityApplication> | undefined;

export async function getIdentityApplication() {
  if (application) return application;
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoIdentityRepositories(database, client);
  const ports: IdentityApplicationPorts = {
    ...repositories,
    passwords: new Argon2idPasswordHasher(),
    dummyPasswordHash: await createDummyPasswordHash(),
    tokens: new SecureOpaqueTokenGenerator(),
    tokenHasher: new SHA256TokenHasher(),
    temporaryPasswords: new ReadableTemporaryPasswordGenerator(),
    ids: { create: randomUUID },
    clock: { now: () => new Date() },
    transactions: new MongoTransactionRunner(client, database),
  };
  application = createIdentityApplication(ports);
  return application;
}
