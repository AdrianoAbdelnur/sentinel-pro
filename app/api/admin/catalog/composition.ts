import { randomUUID } from "node:crypto";

import { createCatalogReviewApplication } from "@/application/catalog";
import { createMongoCatalogRepositories, getMongoDatabase } from "@/integrations/persistence/mongodb";

async function createCatalogAdminRuntime() {
  const database = await getMongoDatabase();
  const repositories = createMongoCatalogRepositories(database);
  const { resolveCatalogReview, listPendingCatalogReviews } = createCatalogReviewApplication({
    reviews: repositories.reviews,
    fleets: repositories.fleets,
    vehicles: repositories.vehicles,
    vehicleIdentities: repositories.vehicleIdentities,
    fleetIdentities: repositories.fleetIdentities,
    ids: { create: randomUUID },
  });
  return { resolveCatalogReview, listPendingCatalogReviews };
}

let runtime: Awaited<ReturnType<typeof createCatalogAdminRuntime>> | undefined;

export async function getCatalogAdminRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogAdminRuntime();
  return runtime;
}
