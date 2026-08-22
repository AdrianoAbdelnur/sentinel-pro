import { randomUUID } from "node:crypto";

import { CATALOG_ADAPTER_REGISTRATIONS, createCatalogBootstrapApplication } from "@/application/catalog/bootstrap-catalog";
import { createSynchronizeConnectionApplication, type CatalogSyncPorts } from "@/application/catalog/synchronize-connection";
import { createCatalogSyncSourceRegistry } from "@/integrations/catalog/sync-source-adapters";
import { createCatalogRepositories, getMongoClient, getMongoDatabase, initializeCatalogDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

async function createRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  await initializeCatalogDatabase(database);
  const repositories = createCatalogRepositories(database);
  const bootstrap = createCatalogBootstrapApplication({ ...repositories, ids: { create: randomUUID } });
  await bootstrap.registerAdapters(CATALOG_ADAPTER_REGISTRATIONS);
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

let runtime: Promise<Awaited<ReturnType<typeof createRuntime>>> | undefined;

export async function getProviderImportRuntime() {
  runtime ??= createRuntime();
  return runtime;
}
