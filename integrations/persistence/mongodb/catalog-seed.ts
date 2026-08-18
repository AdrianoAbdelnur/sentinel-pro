import { randomUUID } from "node:crypto";

import { createCatalogBootstrapApplication, type CatalogAdapterRegistration } from "@/application/catalog/bootstrap-catalog";

import { initializeCatalogDatabase } from "./catalog-initializer";
import { createCatalogRepositories } from "./catalog-repositories";
import { getMongoDatabase } from "./client";

export const CATALOG_ADAPTER_REGISTRATIONS: readonly CatalogAdapterRegistration[] = [
  { adapterKey: "cybermapa", capabilities: ["gps", "operationalAlerts"], credentialRef: "env:cybermapa", cadenceMinutes: 60 },
  { adapterKey: "howen", capabilities: ["gps", "video", "videoAlerts"], credentialRef: "env:howen", cadenceMinutes: 60 },
];

export async function runCatalogSeed(organizationId?: string) {
  const database = await getMongoDatabase();
  await initializeCatalogDatabase(database);
  const repositories = createCatalogRepositories(database);
  const application = createCatalogBootstrapApplication({ ...repositories, ids: { create: randomUUID } });
  const adapters = await application.registerAdapters(CATALOG_ADAPTER_REGISTRATIONS);
  const grants = organizationId ? await application.grantAllVehicles(organizationId) : undefined;
  return { adapters, grants };
}

if (require.main === module) {
  runCatalogSeed(process.argv[2])
    .then((result) => { process.stdout.write(`${JSON.stringify(result)}
`); process.exit(0); })
    .catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "Catalog seed failed"}
`); process.exit(1); });
}
