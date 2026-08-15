import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createGlobalCatalogRepositories, globalCatalogIndexes, migrateGlobalCatalogDatabase, rollbackGlobalCatalogDatabase } from "./index";

let replSet: MongoMemoryReplSet;
let client: MongoClient;
beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = new MongoClient(replSet.getUri()); await client.connect(); }, 60_000);
afterAll(async () => { await client?.close(); await replSet?.stop(); });

const vehicle = (id: string, plate = "ABC123") => ({ id, normalizedPlate: plate, plate, placementFleetId: `fleet-${id}` });

describe("global catalog v2 Mongo persistence", () => {
  it("creates strict v2 validators and unique indexes idempotently", async () => {
    const db = client.db(`global_catalog_${Date.now()}`);
    await migrateGlobalCatalogDatabase(db);
    await migrateGlobalCatalogDatabase(db);
    for (const [name, indexes] of Object.entries(globalCatalogIndexes)) {
      const actual = await db.collection(name).indexes();
      for (const { key, options } of indexes) expect(actual).toContainEqual(expect.objectContaining({ key, ...options }));
    }
    const now = new Date();
    await expect(db.collection("global_vehicles_v2").insertOne({ schemaVersion: 1, id: "bad", normalizedPlate: "ABC", plate: "ABC", placementFleetId: "fleet", createdAt: now, updatedAt: now, organizationId: "org" } as never)).rejects.toThrow();
    await expect(db.collection("provider_contributions_v2").insertOne({ schemaVersion: 1, id: "bad", connectionId: "c", externalId: "e", vehicleId: "v", capabilities: { gps: "invalid" }, presence: "present", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
  });

  it("enforces global identity and contribution uniqueness without tenant identity", async () => {
    const db = client.db(`global_catalog_${Date.now()}`); await migrateGlobalCatalogDatabase(db);
    const repos = createGlobalCatalogRepositories(db);
    await repos.vehicles.save(vehicle("one"));
    await expect(repos.vehicles.save(vehicle("two"))).rejects.toThrow();
    await repos.contributions.save({ id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: "one", capabilities: { video: "eligible" }, presence: "present" });
    await expect(repos.contributions.save({ id: "contribution-2", connectionId: "connection-1", externalId: "external-1", vehicleId: "one", capabilities: {}, presence: "present" })).rejects.toThrow();
  });

  it("keeps concurrent idempotent writes atomic", async () => {
    const db = client.db(`global_catalog_${Date.now()}`); await migrateGlobalCatalogDatabase(db);
    const repos = createGlobalCatalogRepositories(db);
    const writes = await Promise.all(Array.from({ length: 8 }, () => repos.vehicles.save(vehicle("same"))));
    expect(writes).toHaveLength(8);
    expect(await db.collection("global_vehicles_v2").countDocuments({ id: "same" })).toBe(1);
    expect(await repos.vehicles.findById("same")).toEqual(vehicle("same"));
  });

  it("writes provider contributions atomically while preserving their global vehicle link", async () => {
    const db = client.db(`global_catalog_${Date.now()}`); await migrateGlobalCatalogDatabase(db);
    const repos = createGlobalCatalogRepositories(db);
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" });
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "absent" });
    await expect(repos.contributions.findByConnectionAndExternalId("connection", "external")).resolves.toEqual({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "absent" });
  });

  it("keeps provider definitions and connections global and lists only enabled connections", async () => {
    const db = client.db(`global_catalog_${Date.now()}`); await migrateGlobalCatalogDatabase(db);
    const repos = createGlobalCatalogRepositories(db);
    await repos.providers.save({ id: "provider", adapterKey: "adapter", capabilities: ["gps", "video"] });
    await repos.connections.save({ id: "enabled", providerId: "provider", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 });
    await repos.connections.save({ id: "disabled", providerId: "provider", credentialRef: "vault:provider", enabled: false, cadenceMinutes: 60 });

    await expect(repos.providers.findByAdapterKey("adapter")).resolves.toEqual({ id: "provider", adapterKey: "adapter", capabilities: ["gps", "video"] });
    await expect(repos.connections.listEnabled()).resolves.toEqual([{ id: "enabled", providerId: "provider", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 }]);
  });

  it("stores independent memberships for the same vehicle and provider fleet", async () => {
    const db = client.db(`global_catalog_${Date.now()}`); await migrateGlobalCatalogDatabase(db);
    const repos = createGlobalCatalogRepositories(db);
    await repos.memberships.save({ connectionId: "connection-a", externalFleetId: "fleet", vehicleId: "vehicle", label: "North" });
    await repos.memberships.save({ connectionId: "connection-b", externalFleetId: "fleet", vehicleId: "vehicle", label: "Night" });

    await expect(repos.memberships.listByVehicleId("vehicle")).resolves.toEqual([
      { connectionId: "connection-a", externalFleetId: "fleet", vehicleId: "vehicle", label: "North" },
      { connectionId: "connection-b", externalFleetId: "fleet", vehicleId: "vehicle", label: "Night" },
    ]);
  });

  it("rolls back only empty v2 collections and refuses non-empty collections", async () => {
    const emptyDb = client.db(`global_catalog_empty_${Date.now()}`); await migrateGlobalCatalogDatabase(emptyDb);
    await rollbackGlobalCatalogDatabase(emptyDb);
    expect(await emptyDb.listCollections({}, { nameOnly: true }).toArray()).toEqual([]);

    const populatedDb = client.db(`global_catalog_populated_${Date.now()}`); await migrateGlobalCatalogDatabase(populatedDb);
    await createGlobalCatalogRepositories(populatedDb).vehicles.save(vehicle("kept"));
    await expect(rollbackGlobalCatalogDatabase(populatedDb)).rejects.toThrow(/non-empty/);
    expect(await populatedDb.collection("global_vehicles_v2").countDocuments()).toBe(1);
  });
});
