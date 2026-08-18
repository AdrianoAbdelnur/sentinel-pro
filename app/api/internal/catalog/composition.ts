import { randomUUID } from "node:crypto";

import { createCatalogReviewApplication } from "@/application/catalog/reviews";
import { createSynchronizeConnectionApplication, type CatalogSyncPorts } from "@/application/catalog/synchronize-connection";
import { createCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";
import { createCatalogSyncSourceRegistry } from "@/integrations/catalog/sync-source-adapters";

async function createRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createCatalogRepositories(database);
  const syncRepositories = repositories;
  const application = createSynchronizeConnectionApplication({
    ...repositories,
    ids: { create: randomUUID },
    clock: { now: () => new Date() },
    runs: repositories.syncRuns,
    leases: repositories.syncLeases,
    transactions: new MongoCatalogTransactionRunner(client, database),
  } as unknown as CatalogSyncPorts);
  const reviews = createCatalogReviewApplication(repositories);
  const sources = createCatalogSyncSourceRegistry();
  return { ...application, ...reviews, connections: syncRepositories.connections, providers: syncRepositories.providers, sources };
}

let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;

export async function getCatalogSyncRuntime() {
  if (runtime) return runtime;
  runtime = await createRuntime();
  return runtime;
}
