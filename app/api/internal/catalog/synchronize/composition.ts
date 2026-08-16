import { randomUUID } from "node:crypto";

import { createSynchronizeCatalogConnectionApplication, createSynchronizeDueCatalogConnectionsApplication, type CatalogSyncBatchCandidate, type ProviderConnectionRepository } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import { createMongoCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

import {
  classifyConnectionSourceProblem,
  createConnectionSourceRegistry,
  createDefaultConnectionSourceFactories,
  resolveConnectionSource,
  type ConnectionSourceFactories,
  type ConnectionSourceRegistry,
} from "@/app/api/catalog/connection-sources";

export {
  classifyConnectionSourceProblem,
  createConnectionSourceRegistry,
  createDefaultConnectionSourceFactories,
  resolveConnectionSource,
  type ConnectionSourceFactories,
  type ConnectionSourceRegistry,
} from "@/app/api/catalog/connection-sources";

type SourceResolver = ConnectionSourceFactories | ConnectionSourceRegistry;

export async function buildDueCandidates(
  connections: Pick<ProviderConnectionRepository, "listAll">,
  registry: SourceResolver,
): Promise<{ candidates: CatalogSyncBatchCandidate[]; unsupported: ProviderConnection[]; missingCompanyAssignment: ProviderConnection[]; misconfigured: ProviderConnection[] }> {
  const all = await connections.listAll();
  const candidates: CatalogSyncBatchCandidate[] = [];
  const unsupported: ProviderConnection[] = [];
  const missingCompanyAssignment: ProviderConnection[] = [];
  const misconfigured: ProviderConnection[] = [];

  for (const connection of all) {
    const source = resolveConnectionSource(connection, registry);
    if (source) {
      candidates.push({ organizationId: connection.organizationId, connectionId: connection.id, source });
      continue;
    }
    const problem = classifyConnectionSourceProblem(connection, registry);
    if (problem === "missing-company-assignment") missingCompanyAssignment.push(connection);
    else if (problem === "misconfigured") misconfigured.push(connection);
    else unsupported.push(connection);
  }

  return { candidates, unsupported, missingCompanyAssignment, misconfigured };
}

async function createCatalogSyncRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoCatalogRepositories(database);
  const clock = { now: () => new Date() };
  const ports = { ...repositories, ids: { create: randomUUID }, clock, transactions: new MongoCatalogTransactionRunner(client, database) };
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication(ports);
  const { synchronizeDueCatalogConnections } = createSynchronizeDueCatalogConnectionsApplication({ syncRuns: ports.syncRuns, clock }, synchronizeCatalogConnection);
  const registry = createConnectionSourceRegistry(createDefaultConnectionSourceFactories());

  return { connections: repositories.connections, synchronizeDueCatalogConnections, registry };
}

let runtime: Awaited<ReturnType<typeof createCatalogSyncRuntime>> | undefined;

export async function getCatalogSyncRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogSyncRuntime();
  return runtime;
}
