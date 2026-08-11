import { randomUUID } from "node:crypto";

import { createSynchronizeCatalogConnectionApplication, createSynchronizeDueCatalogConnectionsApplication, type CatalogImportSource, type CatalogSyncBatchCandidate, type ProviderConnectionRepository } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import { createCybermapaClient } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { createCybermapaImportSource } from "@/integrations/cybermapa/source";
import { createHowenClient, type HowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { createHowenImportSource } from "@/integrations/howen/source";
import { createMongoCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

const CREDENTIAL_REF_PROVIDER = /^vault:([a-z0-9]+)\//;

export type ConnectionSourceFactory = (connection: ProviderConnection) => CatalogImportSource | undefined;
export type ConnectionSourceFactories = Record<string, ConnectionSourceFactory>;

function resolveProvider(connection: ProviderConnection): string | undefined {
  return CREDENTIAL_REF_PROVIDER.exec(connection.credentialRef)?.[1];
}

export function resolveConnectionSource(connection: ProviderConnection, factories: ConnectionSourceFactories): CatalogImportSource | undefined {
  const provider = resolveProvider(connection);
  return provider ? factories[provider]?.(connection) : undefined;
}

export async function buildDueCandidates(
  connections: Pick<ProviderConnectionRepository, "listAll">,
  factories: ConnectionSourceFactories,
): Promise<{ candidates: CatalogSyncBatchCandidate[]; unsupported: ProviderConnection[]; missingCompanyAssignment: ProviderConnection[] }> {
  const all = await connections.listAll();
  const candidates: CatalogSyncBatchCandidate[] = [];
  const unsupported: ProviderConnection[] = [];
  const missingCompanyAssignment: ProviderConnection[] = [];

  for (const connection of all) {
    const source = resolveConnectionSource(connection, factories);
    if (source) {
      candidates.push({ organizationId: connection.organizationId, connectionId: connection.id, source });
      continue;
    }
    const provider = resolveProvider(connection);
    if (provider && factories[provider]) missingCompanyAssignment.push(connection);
    else unsupported.push(connection);
  }

  return { candidates, unsupported, missingCompanyAssignment };
}

function createHowenConnectionFactory(): ConnectionSourceFactory {
  let client: HowenClient | undefined;
  return (connection) => {
    if (!connection.companyId) return undefined;
    try {
      if (!client) {
        const config = readHowenConfig();
        client = createHowenClient({ config, session: createHowenSessionManager({ config }) });
      }
      return createHowenImportSource({ client, companyId: connection.companyId });
    } catch {
      return undefined;
    }
  };
}

export function createDefaultConnectionSourceFactories(): ConnectionSourceFactories {
  return {
    cybermapa: () => createCybermapaImportSource({ client: createCybermapaClient({ config: readCybermapaConfig() }) }),
    howen: createHowenConnectionFactory(),
  };
}

async function createCatalogSyncRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoCatalogRepositories(database);
  const clock = { now: () => new Date() };
  const ports = { ...repositories, ids: { create: randomUUID }, clock, transactions: new MongoCatalogTransactionRunner(client, database) };
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication(ports);
  const { synchronizeDueCatalogConnections } = createSynchronizeDueCatalogConnectionsApplication({ syncRuns: ports.syncRuns, clock }, synchronizeCatalogConnection);
  const factories = createDefaultConnectionSourceFactories();

  return { connections: repositories.connections, synchronizeDueCatalogConnections, factories };
}

let runtime: Awaited<ReturnType<typeof createCatalogSyncRuntime>> | undefined;

export async function getCatalogSyncRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogSyncRuntime();
  return runtime;
}
