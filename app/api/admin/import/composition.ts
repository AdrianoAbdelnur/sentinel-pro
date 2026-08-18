import { randomUUID } from "node:crypto";

import { createSynchronizeGlobalConnectionApplication, type GlobalSyncPorts } from "@/application/catalog/synchronize-global-connection";
import { createGlobalSyncSourceRegistry } from "@/integrations/catalog/global-sync-source-adapters";
import { createGlobalCatalogRepositories, getMongoClient, getMongoDatabase, MongoGlobalCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

async function createRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createGlobalCatalogRepositories(database);
  const application = createSynchronizeGlobalConnectionApplication({
    ...repositories,
    ids: { create: randomUUID },
    clock: { now: () => new Date() },
    runs: repositories.syncRuns,
    leases: repositories.syncLeases,
    transactions: new MongoGlobalCatalogTransactionRunner(client, database),
  } as unknown as GlobalSyncPorts);
  return { ...application, connections: repositories.connections, providers: repositories.providers, sources: createGlobalSyncSourceRegistry() };
}

let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

export async function getProviderImportRuntime() {
  runtime ??= await createRuntime();
  return runtime;
}
