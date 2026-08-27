import { getMongoDatabase } from "./client";
import { initializeCatalogDatabase } from "./catalog-initializer";

export async function migrateCatalogDatabase() {
  const db = await getMongoDatabase();
  await initializeCatalogDatabase(db);
  const contributions = db.collection<{ connectionId: string; externalId: string; vehicleId: string; capabilities?: Record<string, string>; presence?: "present" | "absent" }>("provider_contributions");
  const devices = db.collection("catalog_devices");
  let backfilled = 0;
  for await (const contribution of contributions.find({})) {
    const result = await devices.updateOne(
      { connectionId: contribution.connectionId, deviceId: contribution.externalId },
      { $setOnInsert: { schemaVersion: 1, id: `${contribution.connectionId}:${contribution.externalId}`, vehicleId: contribution.vehicleId, connectionId: contribution.connectionId, deviceId: contribution.externalId, capabilities: contribution.capabilities ?? {}, presence: contribution.presence ?? "present", createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount === 1) backfilled += 1;
  }
  return { backfilled };
}

if (require.main === module) migrateCatalogDatabase().then((result) => { process.stdout.write(`${JSON.stringify(result)}\n`); }).catch(() => process.exit(1));
