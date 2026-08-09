import { getMongoDatabase } from "./client.ts";
import { migrateCatalogDatabase } from "./catalog-migrations.ts";

migrateCatalogDatabase(await getMongoDatabase()).then(() => process.exit(0)).catch(() => process.exit(1));
