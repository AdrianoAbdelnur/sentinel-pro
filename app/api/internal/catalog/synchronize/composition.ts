import { randomUUID } from "node:crypto";

import { createSynchronizeCatalogConnectionApplication, createSynchronizeDueCatalogConnectionsApplication, type CatalogImportSource, type CatalogSyncBatchCandidate, type ProviderConnectionRepository } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import { createCybermapaClient } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { createCybermapaImportSource } from "@/integrations/cybermapa/source";
import { createMongoCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

const CREDENTIAL_REF_PROVIDER = /^vault:([a-z0-9]+)\//;

export type ConnectionSourceFactories = Record<string, () => CatalogImportSource>;

export function resolveConnectionSource(connection: ProviderConnection, factories: ConnectionSourceFactories): CatalogImportSource | undefined {
  const provider = CREDENTIAL_REF_PROVIDER.exec(connection.credentialRef)?.[1];
  return provider ? factories[provider]?.() : undefined;
}

export async function buildDueCandidates(
  connections: Pick<ProviderConnectionRepository, "listAll">,
  factories: ConnectionSourceFactories,
): Promise<{ candidates: CatalogSyncBatchCandidate[]; unsupported: ProviderConnection[] }> {
  const all = await connections.listAll();
  const candidates: CatalogSyncBatchCandidate[] = [];
  const unsupported: ProviderConnection[] = [];

  for (const connection of all) {
    const source = resolveConnectionSource(connection, factories);
    if (source) candidates.push({ organizationId: connection.organizationId, connectionId: connection.id, source });
    else unsupported.push(connection);
  }

  return { candidates, unsupported };
}

async function createCatalogSyncRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoCatalogRepositories(database);
  const clock = { now: () => new Date() };
  const ports = { ...repositories, ids: { create: randomUUID }, clock, transactions: new MongoCatalogTransactionRunner(client, database) };
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication(ports);
  const { synchronizeDueCatalogConnections } = createSynchronizeDueCatalogConnectionsApplication({ syncRuns: ports.syncRuns, clock }, synchronizeCatalogConnection);
  const factories: ConnectionSourceFactories = { cybermapa: () => createCybermapaImportSource({ client: createCybermapaClient({ config: readCybermapaConfig() }) }) };

  return { connections: repositories.connections, synchronizeDueCatalogConnections, factories };
}

let runtime: Awaited<ReturnType<typeof createCatalogSyncRuntime>> | undefined;

export async function getCatalogSyncRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogSyncRuntime();
  return runtime;
}
