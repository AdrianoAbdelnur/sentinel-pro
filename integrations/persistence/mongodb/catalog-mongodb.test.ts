import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { catalogIndexes, createMongoCatalogRepositories, migrateCatalogDatabase, MongoCatalogTransactionRunner } from "./index";
import { createCatalogApplication } from "@/application/catalog";

let replSet: MongoMemoryReplSet; let client: MongoClient;
beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = new MongoClient(replSet.getUri()); await client.connect(); }, 60_000);
afterAll(async () => { await client?.close(); await replSet?.stop(); });

describe("Mongo catalog persistence", () => {
  it("creates strict validators and all required indexes idempotently", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db); await migrateCatalogDatabase(db);
    for (const [name, indexes] of Object.entries(catalogIndexes)) {
      const actual = await db.collection(name).indexes();
      for (const { key, options } of indexes) expect(actual).toContainEqual(expect.objectContaining({ key, ...options }));
    }
    const now = new Date();
    await expect(db.collection("companies").insertOne({ schemaVersion: 1, id: "c", name: "Acme", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("fleets").insertOne({ schemaVersion: 1, id: "f", companyId: "c", name: "North", kind: "bogus", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("vehicles").insertOne({ schemaVersion: 1, id: "v", companyId: "c", origin: "bogus", placement: { fleetId: "f", source: "system" }, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("company_candidates").insertOne({ schemaVersion: 1, id: "cand", organizationId: "org", connectionId: "conn", normalizedLabel: "acme", unexpected: true, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("provider_connections").insertOne({ schemaVersion: 1, id: "conn", organizationId: "org", credentialRef: "vault:cybermapa/org-a", credentialValue: "leaked-secret", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
  });

  it("upgrades an already-existing collection's validator on repeated migration instead of failing", async () => {
    const db = client.db(`catalog_${Date.now()}`);
    const now = new Date();
    await db.createCollection("companies", { validator: { $jsonSchema: { bsonType: "object" } } });
    await db.collection("companies").insertOne({ legacyOnly: true });

    await migrateCatalogDatabase(db);
    await migrateCatalogDatabase(db);

    await expect(db.collection("companies").insertOne({ schemaVersion: 1, id: "c", name: "Acme", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
  });

  it("rejects a second Unassigned Fleet for the same Company at the database level, while different Companies may each have their own", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("fleets").insertOne({ schemaVersion: 1, id: "unassigned-a", companyId: "company-a", name: "Unassigned", kind: "unassigned", createdAt: now, updatedAt: now });

    await expect(db.collection("fleets").insertOne({ schemaVersion: 1, id: "unassigned-a-2", companyId: "company-a", name: "Unassigned", kind: "unassigned", createdAt: now, updatedAt: now })).rejects.toThrow();
    await expect(db.collection("fleets").insertOne({ schemaVersion: 1, id: "unassigned-b", companyId: "company-b", name: "Unassigned", kind: "unassigned", createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("scopes Fleet and Vehicle listings to their own Company", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.fleets.save({ id: "fleet-a", companyId: "company-a", name: "North", kind: "standard" });
    await repos.fleets.save({ id: "fleet-b", companyId: "company-b", name: "South", kind: "standard" });
    await repos.vehicles.save({ id: "vehicle-a", companyId: "company-a", origin: "native", placement: { fleetId: "fleet-a", source: "admin" } });
    await repos.vehicles.save({ id: "vehicle-b", companyId: "company-b", origin: "native", placement: { fleetId: "fleet-b", source: "admin" } });

    expect((await repos.fleets.listByCompany("company-a")).map((fleet) => fleet.id)).toEqual(["fleet-a"]);
    expect((await repos.vehicles.listByCompany("company-b")).map((vehicle) => vehicle.id)).toEqual(["vehicle-b"]);
  });

  it("scopes provider connection lookups to their own tenant and never persists a credential value", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.connections.save({ id: "conn-a", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a" });
    await repos.connections.save({ id: "conn-b", organizationId: "org-b", credentialRef: "vault:cybermapa/org-b" });

    await expect(repos.connections.findById("org-a", "conn-b")).resolves.toBeUndefined();
    await expect(repos.connections.findById("org-a", "conn-a")).resolves.toEqual({ id: "conn-a", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a" });
    expect(Object.keys((await db.collection("provider_connections").findOne({ id: "conn-a" }))!)).toEqual(expect.arrayContaining(["credentialRef"]));
    expect(Object.keys((await db.collection("provider_connections").findOne({ id: "conn-a" }))!)).not.toContain("credentialValue");
  });

  it("scopes candidate lookup by connection and label to its own tenant", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.candidates.save({ id: "cand-a", organizationId: "org-a", connectionId: "shared-connection", normalizedLabel: "acme" });
    await repos.candidates.save({ id: "cand-b", organizationId: "org-b", connectionId: "shared-connection", normalizedLabel: "acme" });

    await expect(repos.candidates.findByConnectionAndLabel("org-a", "shared-connection", "acme")).resolves.toMatchObject({ id: "cand-a", organizationId: "org-a" });
    await expect(repos.candidates.findByConnectionAndLabel("org-b", "shared-connection", "acme")).resolves.toMatchObject({ id: "cand-b", organizationId: "org-b" });
  });

  it("leaves no orphaned Company when the transactional Unassigned Fleet write fails", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const now = new Date();
    await db.collection("fleets").insertOne({ schemaVersion: 1, id: "pre-existing-unassigned", companyId: "colliding-company", name: "Unassigned", kind: "unassigned", createdAt: now, updatedAt: now });
    let sequence = 0;
    const app = createCatalogApplication({ ...repos, ids: { create: () => (++sequence === 1 ? "colliding-company" : "new-fleet") }, transactions: new MongoCatalogTransactionRunner(client, db) });

    await expect(app.createCompany({ actor: { userId: "admin", organizationId: "org-a", role: "admin" }, name: "Acme" })).rejects.toThrow();

    expect(await db.collection("companies").countDocuments({ id: "colliding-company" })).toBe(0);
  });
});
