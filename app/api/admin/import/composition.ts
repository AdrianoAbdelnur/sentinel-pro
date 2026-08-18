import { randomUUID } from "node:crypto";

import { createSynchronizeConnectionApplication, type CatalogSyncPorts } from "@/application/catalog/synchronize-connection";
import { createCatalogSyncSourceRegistry } from "@/integrations/catalog/sync-source-adapters";
import { createCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

async function createRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createCatalogRepositories(database);
  const application = createSynchronizeConnectionApplication({
    ...repositories,
    ids: { create: randomUUID },
    clock: { now: () => new Date() },
    runs: repositories.syncRuns,
    leases: repositories.syncLeases,
    transactions: new MongoCatalogTransactionRunner(client, database),
  } as unknown as CatalogSyncPorts);
  return { ...application, connections: repositories.connections, providers: repositories.providers, sources: createCatalogSyncSourceRegistry() };
}

let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

export async function getProviderImportRuntime() {
  runtime ??= await createRuntime();
  return runtime;
}
