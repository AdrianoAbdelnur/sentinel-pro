import { getMongoDatabase } from "./client.ts";
import { initializeCatalogDatabase } from "./catalog-initializer.ts";

initializeCatalogDatabase(await getMongoDatabase()).then(() => process.exit(0)).catch(() => process.exit(1));
