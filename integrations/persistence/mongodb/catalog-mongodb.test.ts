import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { catalogIndexes, createMongoCatalogRepositories, migrateCatalogDatabase, MongoCatalogTransactionRunner } from "./index";
import { createCatalogApplication } from "@/application/catalog";
import { failCatalogSyncRun, markCatalogImportItemProcessed, resolveCatalogReviewToFleet, resolveCatalogReviewToVehicle, stageCatalogImportItem, stageFleetBindingReview, stageVehicleMatchReview, startCatalogSyncRun, succeedCatalogSyncRun } from "@/domain/catalog";

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
    await expect(db.collection("provider_connections").insertOne({ schemaVersion: 1, id: "conn-raw", organizationId: "org", credentialRef: "sk-live-topsecret1234567890", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-x", organizationId: "org", connectionId: "conn", entityKind: "vehicle", externalId: "F1", label: "north", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-y", organizationId: "org", connectionId: "conn", entityKind: "vehicle", externalId: "gps-1", vehicleId: "v", unexpected: true, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-x", organizationId: "org", connectionId: "conn", companyId: "company", subject: "bogus", externalId: "gps-1", status: "pending", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-leak", organizationId: "org", connectionId: "conn", companyId: "company", subject: "vehicle-match", externalId: "gps-1", status: "pending", normalizedPlate: "ABC123", candidateVehicleIds: [], credentialRef: "leaked-secret", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-unbounded", organizationId: "org", connectionId: "conn", companyId: "company", subject: "vehicle-match", externalId: "gps-1", status: "pending", normalizedPlate: "ABC123", candidateVehicleIds: ["v1", "v2", "v3", "v4", "v5", "v6"], createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "policy-x", organizationId: "org", scope: "bogus", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-1"], createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-x", organizationId: "org", connectionId: "conn", runId: "run-1", externalId: "gps-1", status: "bogus", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
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
    expect((await repos.connections.listAll()).map((connection) => connection.id).sort()).toEqual(["conn-a", "conn-b"]);
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

  it("rejects a duplicate scoped external Fleet identity at the database level, while a different connection or a different tenant may reuse the same external id", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-1", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route", createdAt: now, updatedAt: now });

    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-1-dup", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route again", createdAt: now, updatedAt: now })).rejects.toThrow();
    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-2", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "F100", label: "north route", createdAt: now, updatedAt: now })).resolves.toBeDefined();
    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-3", organizationId: "org-b", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route", createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("rejects a duplicate id on external Fleet identity at the database level even when tenant, connection, and external id all differ", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-shared", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route", createdAt: now, updatedAt: now });

    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-shared", organizationId: "org-b", connectionId: "conn-howen", entityKind: "fleet", externalId: "F200", label: "south route", createdAt: now, updatedAt: now })).rejects.toThrow();
  });

  it("returns every external Fleet identity bound to a canonical Fleet within its own tenant, and resolves a single identity back to its one canonical Fleet", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.fleetIdentities.save({ id: "identity-cyber", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route", fleetId: "fleet-1" });
    await repos.fleetIdentities.save({ id: "identity-howen", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route howen", fleetId: "fleet-1" });
    await repos.fleetIdentities.save({ id: "identity-other-tenant", organizationId: "org-b", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F900", label: "north route", fleetId: "fleet-1" });

    const bound = await repos.fleetIdentities.listByFleetId("org-a", "fleet-1");
    expect(bound.map((identity) => identity.id).sort()).toEqual(["identity-cyber", "identity-howen"]);

    await expect(repos.fleetIdentities.findByConnectionAndExternalId("org-a", "conn-howen", "H900")).resolves.toMatchObject({ fleetId: "fleet-1" });
  });

  it("scopes external Fleet identity lookup by connection and external id to its own tenant", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.fleetIdentities.save({ id: "identity-a", organizationId: "org-a", connectionId: "shared-connection", entityKind: "fleet", externalId: "F100", label: "north route", fleetId: "fleet-a" });
    await repos.fleetIdentities.save({ id: "identity-b", organizationId: "org-b", connectionId: "shared-connection", entityKind: "fleet", externalId: "F100", label: "north route", fleetId: "fleet-b" });

    await expect(repos.fleetIdentities.findByConnectionAndExternalId("org-a", "shared-connection", "F100")).resolves.toMatchObject({ id: "identity-a" });
    await expect(repos.fleetIdentities.findByConnectionAndExternalId("org-b", "shared-connection", "F100")).resolves.toMatchObject({ id: "identity-b" });
  });

  it("lists external Fleet identities scoped to one tenant and connection, excluding another tenant's or another connection's identities even when the external id repeats", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.fleetIdentities.save({ id: "identity-a", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H100", label: "north route" });
    await repos.fleetIdentities.save({ id: "identity-b", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H200", label: "south route" });
    await repos.fleetIdentities.save({ id: "identity-other-tenant", organizationId: "org-b", connectionId: "conn-howen", entityKind: "fleet", externalId: "H100", label: "north route" });
    await repos.fleetIdentities.save({ id: "identity-other-connection", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "H100", label: "north route" });

    const listed = await repos.fleetIdentities.listByConnection("org-a", "conn-howen");

    expect(listed.map((identity) => identity.id).sort()).toEqual(["identity-a", "identity-b"]);
  });

  it("rejects a duplicate scoped external Vehicle identity at the database level, while a different connection or a different tenant may reuse the same external id", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-1", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", createdAt: now, updatedAt: now });

    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-1-dup", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", createdAt: now, updatedAt: now })).rejects.toThrow();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-2", organizationId: "org-a", connectionId: "conn-howen", entityKind: "vehicle", externalId: "gps-9001", createdAt: now, updatedAt: now })).resolves.toBeDefined();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-3", organizationId: "org-b", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("rejects a duplicate id on external Vehicle identity at the database level even when tenant, connection, and external id all differ", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-shared", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", createdAt: now, updatedAt: now });

    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-shared", organizationId: "org-b", connectionId: "conn-howen", entityKind: "vehicle", externalId: "gps-9002", createdAt: now, updatedAt: now })).rejects.toThrow();
  });

  it("scopes external Vehicle identity lookup by connection and external id to its own tenant", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.vehicleIdentities.save({ id: "identity-a", organizationId: "org-a", connectionId: "shared-connection", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-a" });
    await repos.vehicleIdentities.save({ id: "identity-b", organizationId: "org-b", connectionId: "shared-connection", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-b" });

    await expect(repos.vehicleIdentities.findByConnectionAndExternalId("org-a", "shared-connection", "gps-1")).resolves.toMatchObject({ id: "identity-a" });
    await expect(repos.vehicleIdentities.findByConnectionAndExternalId("org-b", "shared-connection", "gps-1")).resolves.toMatchObject({ id: "identity-b" });
  });

  it("persists last-sighting and presence on an external Vehicle identity without touching the canonical Vehicle it links", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.vehicleIdentities.save({ id: "identity-1", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", vehicleId: "vehicle-1", lastSeenRunId: "run-1", presence: "present" });

    await repos.vehicleIdentities.save({ id: "identity-1", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", vehicleId: "vehicle-1", lastSeenRunId: "run-2", presence: "absent" });

    await expect(repos.vehicleIdentities.findByConnectionAndExternalId("org-a", "conn-cyber", "gps-9001")).resolves.toMatchObject({ vehicleId: "vehicle-1", lastSeenRunId: "run-2", presence: "absent" });
  });

  it("persists bounded per-capability source states on an external Vehicle identity, rejecting an out-of-bound capability key or an out-of-bound state value at the database level", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.vehicleIdentities.save({ id: "identity-1", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001", vehicleId: "vehicle-1", capabilityStates: { gps: "eligible", operationalAlerts: "unsupported" } });

    await expect(repos.vehicleIdentities.findByConnectionAndExternalId("org-a", "conn-cyber", "gps-9001")).resolves.toMatchObject({ capabilityStates: { gps: "eligible", operationalAlerts: "unsupported" } });

    const now = new Date();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-2", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9002", capabilityStates: { video: "eligible", audio: "eligible" }, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-3", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9003", capabilityStates: { gps: "bogus" }, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
  });

  it("lists external Vehicle identities scoped to one tenant and connection, excluding another tenant's or another connection's identities even when the external id repeats", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.vehicleIdentities.save({ id: "identity-a", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-a" });
    await repos.vehicleIdentities.save({ id: "identity-b", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-2", vehicleId: "vehicle-b" });
    await repos.vehicleIdentities.save({ id: "identity-other-tenant", organizationId: "org-b", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-c" });
    await repos.vehicleIdentities.save({ id: "identity-other-connection", organizationId: "org-a", connectionId: "conn-howen", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-d" });

    const listed = await repos.vehicleIdentities.listByConnection("org-a", "conn-cyber");

    expect(listed.map((identity) => identity.id).sort()).toEqual(["identity-a", "identity-b"]);
  });

  it("rejects a duplicate import item for the same run and external id at the database level, while a different run, connection, or tenant may reuse the same external id", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-1", organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now });

    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-1-dup", organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now })).rejects.toThrow();
    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-2", organizationId: "org-a", connectionId: "conn-cyber", runId: "run-2", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now })).resolves.toBeDefined();
    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-3", organizationId: "org-a", connectionId: "conn-howen", runId: "run-1", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now })).resolves.toBeDefined();
    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-4", organizationId: "org-b", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("rejects a duplicate id on catalog import item at the database level even when tenant, connection, run, and external id all differ", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-shared", organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001", status: "pending", createdAt: now, updatedAt: now });

    await expect(db.collection("catalog_import_items").insertOne({ schemaVersion: 1, id: "item-shared", organizationId: "org-b", connectionId: "conn-howen", runId: "run-2", externalId: "gps-9002", status: "pending", createdAt: now, updatedAt: now })).rejects.toThrow();
  });

  it("resolves an import item only when organization, connection, run, and external id all match, returning nothing when any single field differs", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.importItems.save(stageCatalogImportItem("item-1", { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001" }));

    await expect(repos.importItems.findByRunAndExternalId("org-a", "conn-cyber", "run-1", "gps-9001")).resolves.toMatchObject({ id: "item-1", status: "pending" });
    await expect(repos.importItems.findByRunAndExternalId("org-b", "conn-cyber", "run-1", "gps-9001")).resolves.toBeUndefined();
    await expect(repos.importItems.findByRunAndExternalId("org-a", "conn-howen", "run-1", "gps-9001")).resolves.toBeUndefined();
    await expect(repos.importItems.findByRunAndExternalId("org-a", "conn-cyber", "run-2", "gps-9001")).resolves.toBeUndefined();
    await expect(repos.importItems.findByRunAndExternalId("org-a", "conn-cyber", "run-1", "gps-9002")).resolves.toBeUndefined();
  });

  it("resumes an interrupted import run by returning exactly the items still pending for that run, without reprocessing already-committed items, skipping any that remain, or leaking another tenant's or connection's same-run item", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const staged = (externalId: string) => stageCatalogImportItem(`item-${externalId}`, { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId });
    await repos.importItems.save(markCatalogImportItemProcessed(staged("gps-1"), "created"));
    await repos.importItems.save(staged("gps-2"));
    await repos.importItems.save(staged("gps-3"));
    await repos.importItems.save(stageCatalogImportItem("item-other-run", { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-2", externalId: "gps-1" }));
    await repos.importItems.save(stageCatalogImportItem("item-other-tenant", { organizationId: "org-b", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-4" }));
    await repos.importItems.save(stageCatalogImportItem("item-other-connection", { organizationId: "org-a", connectionId: "conn-howen", runId: "run-1", externalId: "gps-5" }));

    const pending = await repos.importItems.listPendingByRun("org-a", "conn-cyber", "run-1");

    expect(pending.map((item) => item.externalId)).toEqual(["gps-2", "gps-3"]);
  });

  it("retains a pending catalog review and resolves it to exactly one Company-scoped Vehicle link", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const pending = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-1", "vehicle-2"] });
    await repos.reviews.save(pending);

    await expect(repos.reviews.findById("review-1")).resolves.toEqual(pending);

    const outcome = resolveCatalogReviewToVehicle(pending, "vehicle-1");
    if (outcome.kind !== "resolved") throw new Error("expected a pending review to resolve");
    await repos.reviews.resolve(outcome.review);

    await expect(repos.reviews.findById("review-1")).resolves.toEqual({ ...pending, status: "resolved", resolvedVehicleId: "vehicle-1" });
    expect(await db.collection("catalog_reviews").countDocuments({ id: "review-1" })).toBe(1);
  });

  it("finds a catalog review by connection and external id scoped to its own tenant, never a same-external-id review from another tenant or connection", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.reviews.save(stageVehicleMatchReview("review-a", { organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-1", "vehicle-2"] }));
    await repos.reviews.save(stageVehicleMatchReview("review-other-tenant", { organizationId: "org-b", connectionId: "conn-cyber", companyId: "company-b", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-3"] }));
    await repos.reviews.save(stageVehicleMatchReview("review-other-connection", { organizationId: "org-a", connectionId: "conn-howen", companyId: "company-a", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-4"] }));

    await expect(repos.reviews.findByConnectionAndExternalId("org-a", "conn-cyber", "gps-9001", "vehicle-match")).resolves.toMatchObject({ id: "review-a" });
    await expect(repos.reviews.findByConnectionAndExternalId("org-b", "conn-cyber", "gps-9002", "vehicle-match")).resolves.toBeUndefined();
  });

  it("does not let a fleet-binding review and a vehicle-match review sharing one connection and external id collide with each other", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.reviews.save(stageFleetBindingReview("review-fleet", { organizationId: "org-a", connectionId: "conn-howen", companyId: "company-a", externalId: "shared-id", label: "north route", candidateFleetIds: [] }));
    await repos.reviews.save(stageVehicleMatchReview("review-vehicle", { organizationId: "org-a", connectionId: "conn-howen", companyId: "company-a", externalId: "shared-id", normalizedPlate: "", candidateVehicleIds: ["vehicle-1"] }));

    await expect(repos.reviews.findByConnectionAndExternalId("org-a", "conn-howen", "shared-id", "fleet-binding")).resolves.toMatchObject({ id: "review-fleet" });
    await expect(repos.reviews.findByConnectionAndExternalId("org-a", "conn-howen", "shared-id", "vehicle-match")).resolves.toMatchObject({ id: "review-vehicle" });
  });

  it("lists pending catalog reviews scoped to their own tenant, excluding resolved reviews", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.reviews.save(stageFleetBindingReview("review-a", { organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", externalId: "F100", label: "north route", candidateFleetIds: [] }));
    const resolvedOwnTenant = stageFleetBindingReview("review-a-resolved", { organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", externalId: "F200", label: "south route", candidateFleetIds: [] });
    const resolvedOutcome = resolveCatalogReviewToFleet(resolvedOwnTenant, "fleet-9");
    if (resolvedOutcome.kind !== "resolved") throw new Error("expected a pending review to resolve");
    await repos.reviews.save(resolvedOutcome.review);
    await repos.reviews.save(stageFleetBindingReview("review-b", { organizationId: "org-b", connectionId: "conn-cyber", companyId: "company-b", externalId: "F100", label: "north route", candidateFleetIds: [] }));

    const pending = await repos.reviews.listPendingByOrganization("org-a");

    expect(pending.map((review) => review.id)).toEqual(["review-a"]);
  });

  it("rejects a duplicate id on catalog review at the database level even when tenant and subject differ", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-shared", organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", subject: "fleet-binding", externalId: "F100", status: "pending", label: "north route", candidateFleetIds: [], createdAt: now, updatedAt: now });

    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-shared", organizationId: "org-b", connectionId: "conn-howen", companyId: "company-b", subject: "vehicle-match", externalId: "gps-1", status: "pending", normalizedPlate: "ABC123", candidateVehicleIds: [], createdAt: now, updatedAt: now })).rejects.toThrow();
  });

  it("rejects resolving a review that another decision already resolved, leaving the first decision intact", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const pending = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-cyber", companyId: "company-a", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-1", "vehicle-2"] });
    await repos.reviews.save(pending);

    const firstOutcome = resolveCatalogReviewToVehicle(pending, "vehicle-1");
    if (firstOutcome.kind !== "resolved") throw new Error("expected a pending review to resolve");
    await expect(repos.reviews.resolve(firstOutcome.review)).resolves.toBe("resolved");

    const staleOutcome = resolveCatalogReviewToVehicle(pending, "vehicle-2");
    if (staleOutcome.kind !== "resolved") throw new Error("expected a pending review to resolve");
    await expect(repos.reviews.resolve(staleOutcome.review)).resolves.toBe("already-resolved");

    await expect(repos.reviews.findById("review-1")).resolves.toMatchObject({ status: "resolved", resolvedVehicleId: "vehicle-1" });
  });

  it("keeps exactly one capability policy document when the same policy id is saved twice through the repository", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.capabilityPolicies.save({ id: "policy-1", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-1"] });

    await repos.capabilityPolicies.save({ id: "policy-1", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-2"] });

    await expect(repos.capabilityPolicies.findByScope("org-a", "fleet", "fleet-a", "gps")).resolves.toMatchObject({ sourceOrder: ["conn-2"] });
    expect(await db.collection("capability_policies").countDocuments({ id: "policy-1" })).toBe(1);
  });

  it("scopes capability policy reads to their own tenant even when scope and scopeId collide", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.capabilityPolicies.save({ id: "policy-a", organizationId: "org-a", scope: "fleet", scopeId: "fleet-shared", capability: "gps", sourceOrder: ["conn-a"] });
    await repos.capabilityPolicies.save({ id: "policy-b", organizationId: "org-b", scope: "fleet", scopeId: "fleet-shared", capability: "gps", sourceOrder: ["conn-b"] });

    await expect(repos.capabilityPolicies.findByScope("org-a", "fleet", "fleet-shared", "gps")).resolves.toMatchObject({ id: "policy-a", sourceOrder: ["conn-a"] });
    await expect(repos.capabilityPolicies.findByScope("org-b", "fleet", "fleet-shared", "gps")).resolves.toMatchObject({ id: "policy-b", sourceOrder: ["conn-b"] });
  });

  it("rejects a second capability policy for the same tenant, scope, scopeId, and capability at the database level, while a different capability may coexist", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    await db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "policy-1", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-1"], createdAt: now, updatedAt: now });

    await expect(db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "policy-2", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-2"], createdAt: now, updatedAt: now })).rejects.toThrow();
    await expect(db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "policy-3", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability: "video", sourceOrder: ["conn-1"], createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("creates strict validators for sync runs and leases, rejecting a bogus trigger, bogus status, unbounded or out-of-shape counts, a negative count, and a lease missing its runId, while accepting a valid bounded run and lease", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    const validCounts = { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-x", organizationId: "org", connectionId: "conn", trigger: "bogus", status: "active", fullSnapshot: true, startedAt: now, counts: validCounts, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-y", organizationId: "org", connectionId: "conn", trigger: "manual", status: "bogus", fullSnapshot: true, startedAt: now, counts: validCounts, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-z", organizationId: "org", connectionId: "conn", trigger: "manual", status: "active", fullSnapshot: true, startedAt: now, counts: { ...validCounts, extra: 1 }, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-w", organizationId: "org", connectionId: "conn", trigger: "manual", status: "active", fullSnapshot: true, startedAt: now, counts: { ...validCounts, processed: -1 }, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-ok", organizationId: "org", connectionId: "conn", trigger: "manual", status: "active", fullSnapshot: true, startedAt: now, counts: validCounts, createdAt: now, updatedAt: now })).resolves.toBeDefined();
    await expect(db.collection("catalog_sync_leases").insertOne({ schemaVersion: 1, organizationId: "org", connectionId: "conn", leaseUntil: now, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_sync_leases").insertOne({ schemaVersion: 1, organizationId: "org", connectionId: "conn", runId: "run-1", leaseUntil: now, createdAt: now, updatedAt: now })).resolves.toBeDefined();
  });

  it("rejects a second active run for the same connection at the database level, while a different connection, a different tenant, and a completed run for the same connection may each proceed", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    const zero = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
    const run = (id: string, organizationId: string, connectionId: string, status: "active" | "succeeded") => ({ schemaVersion: 1, id, organizationId, connectionId, trigger: "manual" as const, status, fullSnapshot: true, startedAt: now, counts: zero, createdAt: now, updatedAt: now });
    await db.collection("catalog_import_runs").insertOne(run("run-a", "org-a", "conn-cyber", "active"));

    await expect(db.collection("catalog_import_runs").insertOne(run("run-a-2", "org-a", "conn-cyber", "active"))).rejects.toThrow();
    await expect(db.collection("catalog_import_runs").insertOne(run("run-b", "org-a", "conn-howen", "active"))).resolves.toBeDefined();
    await expect(db.collection("catalog_import_runs").insertOne(run("run-c", "org-b", "conn-cyber", "active"))).resolves.toBeDefined();
    await expect(db.collection("catalog_import_runs").insertOne(run("run-d", "org-a", "conn-cyber", "succeeded"))).resolves.toBeDefined();
  });

  it("rejects a duplicate id on catalog sync run at the database level even when tenant, connection, and status differ", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const now = new Date();
    const zero = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
    await db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-shared", organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", status: "active", fullSnapshot: true, startedAt: now, counts: zero, createdAt: now, updatedAt: now });

    await expect(db.collection("catalog_import_runs").insertOne({ schemaVersion: 1, id: "run-shared", organizationId: "org-b", connectionId: "conn-howen", trigger: "initial", status: "succeeded", fullSnapshot: true, startedAt: now, completedAt: now, counts: zero, createdAt: now, updatedAt: now })).rejects.toThrow();
  });

  it("claims an active run through the repository only when none is active for that connection, and allows a new claim once the previous run has been saved as no longer active", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const first = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));

    await expect(repos.syncRuns.claimActive(first)).resolves.toBe("claimed");
    const second = startCatalogSyncRun("run-2", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", fullSnapshot: true }, new Date("2026-01-01T00:05:00Z"));
    await expect(repos.syncRuns.claimActive(second)).resolves.toBe("already-active");

    await repos.syncRuns.save(succeedCatalogSyncRun(first, new Date("2026-01-01T00:10:00Z"), { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }));
    await expect(repos.syncRuns.claimActive(second)).resolves.toBe("claimed");
  });

  it("returns the most recently started run for a connection scoped to its own tenant, ignoring a same-runId-shaped run under a different tenant or connection", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const older = succeedCatalogSyncRun(startCatalogSyncRun("run-old", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z")), new Date("2026-01-01T00:00:30Z"), { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 });
    const newer = startCatalogSyncRun("run-new", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T06:00:00Z"));
    const otherTenant = startCatalogSyncRun("run-other-tenant", { organizationId: "org-b", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T12:00:00Z"));
    const otherConnection = startCatalogSyncRun("run-other-conn", { organizationId: "org-a", connectionId: "conn-howen", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T12:00:00Z"));
    await repos.syncRuns.save(older); await repos.syncRuns.save(newer); await repos.syncRuns.save(otherTenant); await repos.syncRuns.save(otherConnection);

    await expect(repos.syncRuns.findLatest("org-a", "conn-cyber")).resolves.toMatchObject({ id: "run-new" });
  });

  it("returns the last successful run for a connection scoped to its own tenant, skipping an active or failed run, a succeeded run belonging to another connection, and a later succeeded run belonging to another tenant", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const zero = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
    const olderSuccess = succeedCatalogSyncRun(startCatalogSyncRun("run-success-old", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z")), new Date("2026-01-01T00:05:00Z"), zero);
    const newerSuccess = succeedCatalogSyncRun(startCatalogSyncRun("run-success-new", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T06:00:00Z")), new Date("2026-01-01T06:05:00Z"), zero);
    const laterFailed = failCatalogSyncRun(startCatalogSyncRun("run-failed", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T12:00:00Z")), new Date("2026-01-01T12:01:00Z"), { category: "timeout" });
    const otherConnectionSuccess = succeedCatalogSyncRun(startCatalogSyncRun("run-other-conn", { organizationId: "org-a", connectionId: "conn-howen", trigger: "initial", fullSnapshot: true }, new Date("2026-01-01T18:00:00Z")), new Date("2026-01-01T18:05:00Z"), zero);
    const otherTenantLaterSuccess = succeedCatalogSyncRun(startCatalogSyncRun("run-other-tenant", { organizationId: "org-b", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true }, new Date("2026-01-02T00:00:00Z")), new Date("2026-01-02T00:05:00Z"), zero);
    for (const run of [olderSuccess, newerSuccess, laterFailed, otherConnectionSuccess, otherTenantLaterSuccess]) await repos.syncRuns.save(run);

    await expect(repos.syncRuns.findLastSuccess("org-a", "conn-cyber")).resolves.toMatchObject({ id: "run-success-new" });
  });

  it("claims a fresh lease when none exists, refuses to steal a lease that has not yet expired according to the injected clock, and atomically takes it over once that same clock reaches its leaseUntil", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const claimedAt = new Date("2026-01-01T00:00:00Z");

    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-1", claimedAt, 60_000)).resolves.toEqual({ outcome: "claimed" });
    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-2", new Date("2026-01-01T00:00:30Z"), 60_000)).resolves.toEqual({ outcome: "held" });

    const takeover = await repos.syncLeases.claim("org-a", "conn-cyber", "run-3", new Date("2026-01-01T00:01:00Z"), 60_000);
    expect(takeover).toEqual({ outcome: "claimed", previousRunId: "run-1" });
  });

  it("lets the owning run id renew its own lease before expiry without being told it is held, extending leaseUntil, while a different run id racing at that same instant still yields exactly one winner", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const claimedAt = new Date("2026-01-01T00:00:00Z");
    await repos.syncLeases.claim("org-a", "conn-cyber", "run-1", claimedAt, 60_000);

    const renewedAt = new Date("2026-01-01T00:00:30Z");
    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-1", renewedAt, 60_000)).resolves.toEqual({ outcome: "claimed" });
    const stored = await db.collection("catalog_sync_leases").findOne({ organizationId: "org-a", connectionId: "conn-cyber" });
    expect(stored?.leaseUntil.toISOString()).toBe(new Date(renewedAt.getTime() + 60_000).toISOString());

    const [renewal, rival] = await Promise.all([
      repos.syncLeases.claim("org-a", "conn-cyber", "run-1", new Date("2026-01-01T00:00:31Z"), 60_000),
      repos.syncLeases.claim("org-a", "conn-cyber", "run-rival", new Date("2026-01-01T00:00:31Z"), 60_000),
    ]);
    expect([renewal.outcome, rival.outcome].sort()).toEqual(["claimed", "held"]);
  });

  it("lets exactly one of two concurrent claimants win a brand-new lease for the same connection, proven against a real MongoDB race rather than a sequential simulation", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const now = new Date("2026-01-01T00:00:00Z");

    const [first, second] = await Promise.all([
      repos.syncLeases.claim("org-a", "conn-cyber", "run-first", now, 60_000),
      repos.syncLeases.claim("org-a", "conn-cyber", "run-second", now, 60_000),
    ]);

    expect([first.outcome, second.outcome].sort()).toEqual(["claimed", "held"]);
  });

  it("releases a held lease only when the caller's own run id still owns it, leaving another owner's lease untouched, and allows a fresh claim once truly released", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const now = new Date("2026-01-01T00:00:00Z");
    await repos.syncLeases.claim("org-a", "conn-cyber", "run-1", now, 60_000);

    await repos.syncLeases.release("org-a", "conn-cyber", "run-wrong-owner");
    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-2", new Date("2026-01-01T00:00:10Z"), 60_000)).resolves.toEqual({ outcome: "held" });

    await repos.syncLeases.release("org-a", "conn-cyber", "run-1");
    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-3", new Date("2026-01-01T00:00:20Z"), 60_000)).resolves.toEqual({ outcome: "claimed" });
  });

  it("scopes lease claim and release to their own tenant and connection: a different tenant or connection may each claim independently while the first still holds a lease, a release under another tenant's identifiers never clears it, and a different tenant claiming the same connection after the first tenant's lease has expired gets its own untouched document rather than hijacking the expired one", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const now = new Date("2026-01-01T00:00:00Z");
    await repos.syncLeases.claim("org-a", "conn-cyber", "run-a", now, 60_000);

    await expect(repos.syncLeases.claim("org-b", "conn-cyber", "run-b", now, 60_000)).resolves.toEqual({ outcome: "claimed" });
    await expect(repos.syncLeases.claim("org-a", "conn-howen", "run-c", now, 60_000)).resolves.toEqual({ outcome: "claimed" });

    await repos.syncLeases.release("org-b", "conn-cyber", "run-a");
    await expect(repos.syncLeases.claim("org-a", "conn-cyber", "run-rival", now, 60_000)).resolves.toEqual({ outcome: "held" });

    const expiredNow = new Date("2026-01-02T00:00:00Z");
    await expect(repos.syncLeases.claim("org-c", "conn-cyber", "run-d", expiredNow, 60_000)).resolves.toEqual({ outcome: "claimed" });
    await expect(db.collection("catalog_sync_leases").findOne({ organizationId: "org-a", connectionId: "conn-cyber" })).resolves.toMatchObject({ runId: "run-a" });
    await expect(db.collection("catalog_sync_leases").countDocuments({ connectionId: "conn-cyber" })).resolves.toBe(3);

    await repos.syncLeases.claim("org-a", "conn-phantom", "run-c", expiredNow, 60_000);
    await expect(db.collection("catalog_sync_leases").countDocuments({ organizationId: "org-a", connectionId: "conn-phantom" })).resolves.toBe(1);
  });

  it("recovers a connection whose process died holding an active run and lease, by abandoning the stale run the takeover reveals and then claiming a fresh active run", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const crashedAt = new Date("2026-01-01T00:00:00Z");
    await repos.syncLeases.claim("org-a", "conn-cyber", "run-crashed", crashedAt, 60_000);
    await repos.syncRuns.claimActive(startCatalogSyncRun("run-crashed", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, crashedAt));

    const recoveredAt = new Date("2026-01-01T00:01:00Z");
    const takeover = await repos.syncLeases.claim("org-a", "conn-cyber", "run-recovered", recoveredAt, 60_000);
    if (takeover.outcome !== "claimed" || !takeover.previousRunId) throw new Error("expected a takeover with a previous run id");
    const stale = await repos.syncRuns.findById(takeover.previousRunId);
    if (!stale) throw new Error("expected the crashed run to still exist");
    await repos.syncRuns.save(failCatalogSyncRun(stale, recoveredAt, { category: "internal" }));

    await expect(repos.syncRuns.claimActive(startCatalogSyncRun("run-recovered", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, recoveredAt))).resolves.toBe("claimed");
  });

  it("persists a failure summary composed only from a fixed category label and a pattern-bounded provider error code, so a caller-supplied credential, connection URL, or raw provider payload never reaches the stored run document even when handed directly to the only field that accepts free text", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    const started = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));
    const leakedProviderErrorCode = 'auth failed credentialRef=vault:cybermapa/org-a Bearer sk-live-topsecret payload={"gps_id":1,"token":"sk-live-topsecret"}';

    await repos.syncRuns.save(failCatalogSyncRun(started, new Date("2026-01-01T00:01:00Z"), { category: "authentication", providerErrorCode: leakedProviderErrorCode }));

    const stored = await db.collection("catalog_import_runs").findOne({ id: "run-1" });
    expect(stored?.failureSummary).toBe("Authentication failed");
    expect(JSON.stringify(stored)).not.toContain("sk-live-topsecret");
    expect(JSON.stringify(stored)).not.toContain("vault:cybermapa");
  });

  it("finds present external Vehicle identities not seen in the given run, scoped to their own tenant and connection, without disturbing an already-absent identity or a same-run identity elsewhere", async () => {
    const db = client.db(`catalog_${Date.now()}`); await migrateCatalogDatabase(db);
    const repos = createMongoCatalogRepositories(db);
    await repos.vehicleIdentities.save({ id: "identity-stale", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-1", lastSeenRunId: "run-1", presence: "present" });
    await repos.vehicleIdentities.save({ id: "identity-fresh", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-2", vehicleId: "vehicle-2", lastSeenRunId: "run-2", presence: "present" });
    await repos.vehicleIdentities.save({ id: "identity-already-absent", organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-3", vehicleId: "vehicle-3", lastSeenRunId: "run-1", presence: "absent" });
    await repos.vehicleIdentities.save({ id: "identity-other-tenant", organizationId: "org-b", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-4", lastSeenRunId: "run-1", presence: "present" });
    await repos.vehicleIdentities.save({ id: "identity-other-connection", organizationId: "org-a", connectionId: "conn-howen", entityKind: "vehicle", externalId: "gps-1", vehicleId: "vehicle-5", lastSeenRunId: "run-1", presence: "present" });

    const stale = await repos.vehicleIdentities.listStaleByRun("org-a", "conn-cyber", "run-2");

    expect(stale.map((identity) => identity.id)).toEqual(["identity-stale"]);
  });
});
