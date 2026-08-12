import { randomUUID } from "node:crypto";
import { createProviderImportApplication } from "@/application/catalog";
import { createDefaultConnectionSourceFactories } from "@/app/api/catalog/connection-sources";
import { createMongoCatalogRepositories, getMongoDatabase } from "@/integrations/persistence/mongodb";
import { MongoCatalogTransactionRunner, getMongoClient } from "@/integrations/persistence/mongodb";
import { createSynchronizeCatalogConnectionApplication } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import type { Company } from "@/domain/catalog";

export async function getProviderImportRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoCatalogRepositories(database);
  const ids = { create: randomUUID };
  const clock = { now: () => new Date() };
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication({ ...repositories, ids, clock, transactions: new MongoCatalogTransactionRunner(client, database) });
  const factories = createDefaultConnectionSourceFactories();
  const companies = repositories.companies as typeof repositories.companies & { listByOrganization(organizationId: string): Promise<Company[]> };
  return createProviderImportApplication({
    companies,
    fleets: repositories.fleets,
    connections: repositories.connections,
    ids,
    synchronize: synchronizeCatalogConnection,
    async loadSource(provider, companyId) {
      const factory = factories[provider];
      if (!factory) throw new Error("unsupported provider");
      const connection: ProviderConnection = { id: "provider-import", organizationId: "provider-import", credentialRef: "vault:" + provider + "/provider-import", ...(companyId && companyId !== "preview" ? { companyId } : {}) };
      const source = factory(connection);
      if (!source) throw new Error("provider source unavailable");
      return source;
    },
  });
}
