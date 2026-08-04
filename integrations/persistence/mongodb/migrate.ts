import { getMongoDatabase } from "./client.ts";
import { migrateIdentityDatabase } from "./migrations.ts";

migrateIdentityDatabase(await getMongoDatabase()).then(() => process.exit(0)).catch(() => process.exit(1));
