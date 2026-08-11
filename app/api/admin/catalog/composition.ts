import { randomUUID } from "node:crypto";

import { createCatalogReviewApplication, createCompanyBindingApplication, createSynchronizeCatalogConnectionApplication } from "@/application/catalog";
import { createDefaultConnectionSourceFactories } from "@/app/api/internal/catalog/synchronize/composition";
import { createMongoCatalogRepositories, getMongoClient, getMongoDatabase, MongoCatalogTransactionRunner } from "@/integrations/persistence/mongodb";

async function createCatalogAdminRuntime() {
  const [client, database] = await Promise.all([getMongoClient(), getMongoDatabase()]);
  const repositories = createMongoCatalogRepositories(database);
  const ids = { create: randomUUID };
  const clock = { now: () => new Date() };
  const { resolveCatalogReview, listPendingCatalogReviews } = createCatalogReviewApplication({
    reviews: repositories.reviews,
    fleets: repositories.fleets,
    vehicles: repositories.vehicles,
    vehicleIdentities: repositories.vehicleIdentities,
    fleetIdentities: repositories.fleetIdentities,
    ids,
  });
  const { bindProviderCompany } = createCompanyBindingApplication({ companies: repositories.companies, candidates: repositories.candidates, ids });
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication({ ...repositories, ids, clock, transactions: new MongoCatalogTransactionRunner(client, database) });
  const factories = createDefaultConnectionSourceFactories();
  return { resolveCatalogReview, listPendingCatalogReviews, bindProviderCompany, connections: repositories.connections, synchronizeCatalogConnection, factories };
}

let runtime: Awaited<ReturnType<typeof createCatalogAdminRuntime>> | undefined;

export async function getCatalogAdminRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogAdminRuntime();
  return runtime;
}
