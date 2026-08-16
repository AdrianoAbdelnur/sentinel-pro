import { randomUUID } from "node:crypto";

import { createSynchronizeGlobalConnectionApplication, type GlobalSyncPorts } from "@/application/catalog-global/synchronize-global-connection";
import { createGlobalCatalogRepositories, getMongoClient, getMongoDatabase, MongoGlobalCatalogTransactionRunner } from "@/integrations/persistence/mongodb";
import { createGlobalSyncSourceRegistry } from "@/integrations/catalog/global-sync-source-adapters";

async function createRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createGlobalCatalogRepositories(database);
  const syncRepositories = repositories;
  const application = createSynchronizeGlobalConnectionApplication({
    ...repositories,
    ids: { create: randomUUID },
    clock: { now: () => new Date() },
    runs: repositories.syncRuns,
    leases: repositories.syncLeases,
    transactions: new MongoGlobalCatalogTransactionRunner(client, database),
  } as unknown as GlobalSyncPorts);
  const sources = createGlobalSyncSourceRegistry();
  return { ...application, connections: syncRepositories.connections, providers: syncRepositories.providers, sources };
}

let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

export async function getGlobalCatalogSyncRuntime() {
  if (runtime) return runtime;
  runtime = await createRuntime();
  return runtime;
}
