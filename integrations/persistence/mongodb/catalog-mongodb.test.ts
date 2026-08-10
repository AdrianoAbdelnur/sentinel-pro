import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { catalogIndexes, createMongoCatalogRepositories, migrateCatalogDatabase, MongoCatalogTransactionRunner } from "./index";
import { createCatalogApplication } from "@/application/catalog";
import { resolveCatalogReviewToFleet, resolveCatalogReviewToVehicle, stageFleetBindingReview, stageVehicleMatchReview } from "@/domain/catalog";

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
    await expect(db.collection("external_fleet_identities").insertOne({ schemaVersion: 1, id: "identity-x", organizationId: "org", connectionId: "conn", entityKind: "vehicle", externalId: "F1", label: "north", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("external_vehicle_identities").insertOne({ schemaVersion: 1, id: "identity-y", organizationId: "org", connectionId: "conn", entityKind: "vehicle", externalId: "gps-1", vehicleId: "v", unexpected: true, createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-x", organizationId: "org", connectionId: "conn", companyId: "company", subject: "bogus", externalId: "gps-1", status: "pending", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-leak", organizationId: "org", connectionId: "conn", companyId: "company", subject: "vehicle-match", externalId: "gps-1", status: "pending", normalizedPlate: "ABC123", candidateVehicleIds: [], credentialRef: "leaked-secret", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("catalog_reviews").insertOne({ schemaVersion: 1, id: "review-unbounded", organizationId: "org", connectionId: "conn", companyId: "company", subject: "vehicle-match", externalId: "gps-1", status: "pending", normalizedPlate: "ABC123", candidateVehicleIds: ["v1", "v2", "v3", "v4", "v5", "v6"], createdAt: now, updatedAt: now } as never)).rejects.toThrow();
    await expect(db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "policy-x", organizationId: "org", scope: "bogus", scopeId: "fleet-a", capability: "gps", sourceOrder: ["conn-1"], createdAt: now, updatedAt: now } as never)).rejects.toThrow();
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
});
