import { randomUUID } from "node:crypto";

import { createAssignConnectionCompanyApplication, createCatalogReviewApplication, createCompanyBindingApplication, createGetCatalogSyncStatusApplication, createSynchronizeCatalogConnectionApplication } from "@/application/catalog";
import { createDefaultConnectionSourceFactories } from "@/app/api/catalog/connection-sources";
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
    vehicleIdentities: {
      ensureBoundToVehicle: async (identity) => {
        const outcome = await repositories.vehicleIdentities.ensureBoundToVehicle?.(identity);
        if (!outcome) throw new Error("Vehicle identity binding is unavailable");
        return outcome;
      },
    },
    fleetIdentities: repositories.fleetIdentities,
    transactions: new MongoCatalogTransactionRunner(client, database),
    ids,
  });
  const { bindProviderCompany } = createCompanyBindingApplication({ companies: repositories.companies, candidates: repositories.candidates, ids });
  const { assignConnectionCompany } = createAssignConnectionCompanyApplication({ companies: repositories.companies, connections: repositories.connections });
  const { synchronizeCatalogConnection } = createSynchronizeCatalogConnectionApplication({ ...repositories, ids, clock, transactions: new MongoCatalogTransactionRunner(client, database) });
  const { getCatalogSyncStatus } = createGetCatalogSyncStatusApplication({ connections: repositories.connections, syncRuns: repositories.syncRuns, clock });
  const factories = createDefaultConnectionSourceFactories();
  return { resolveCatalogReview, listPendingCatalogReviews, bindProviderCompany, assignConnectionCompany, connections: repositories.connections, synchronizeCatalogConnection, factories, getCatalogSyncStatus };
}

let runtime: Awaited<ReturnType<typeof createCatalogAdminRuntime>> | undefined;

export async function getCatalogAdminRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogAdminRuntime();
  return runtime;
}
