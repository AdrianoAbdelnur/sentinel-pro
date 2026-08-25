import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { matchAndApplyProviderCandidate, type MatchAndApplyDependencies, type ProviderCandidate } from "@/application/catalog/match-and-apply-provider-candidate";
import { catalogCollectionNames, catalogIndexes, createCatalogRepositories, initializeCatalogDatabase } from "./index";

let replSet: MongoMemoryReplSet;
let client: MongoClient;
beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = new MongoClient(replSet.getUri()); await client.connect(); }, 60_000);
afterAll(async () => { await client?.close(); await replSet?.stop(); });

const vehicle = (id: string, plate = "ABC123") => ({ id, normalizedPlate: plate, plate, placementFleetId: `fleet-${id}` });

describe("catalog Mongo persistence", () => {
  it("filters and paginates organization vehicles in MongoDB", async () => {
    const db = client.db(`catalog_live_page_${Date.now()}`);
    await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.groups.save({ id: "group-1", label: "North" });
    await repos.vehicles.save({ ...vehicle("vehicle-1", "AAA111"), placementFleetId: "group-1" });
    await repos.vehicles.save({ ...vehicle("vehicle-2", "BBB222"), placementFleetId: "group-1" });
    await repos.vehicles.save({ ...vehicle("vehicle-3", "AAA333"), placementFleetId: "group-1" });
    await repos.grants.save({ organizationId: "organization-1", vehicleId: "vehicle-1" });
    await repos.grants.save({ organizationId: "organization-1", vehicleId: "vehicle-2" });
    await repos.grants.save({ organizationId: "organization-1", vehicleId: "vehicle-3" });

    await expect(repos.vehicles.listByOrganizationAndGroupId("organization-1", "group-1", { page: 1, pageSize: 1, plate: "AAA" })).resolves.toEqual({
      total: 2,
      items: [{ ...vehicle("vehicle-1", "AAA111"), placementFleetId: "group-1" }],
    });
    await expect(repos.vehicles.countByOrganizationAndGroup("organization-1", ["group-1"], "AAA")).resolves.toEqual({ "group-1": 2 });
    await expect(repos.vehicles.listByOrganizationAndGroupRanges("organization-1", [{ groupId: "group-1", skip: 1, limit: 1 }], "AAA")).resolves.toEqual([{ ...vehicle("vehicle-3", "AAA333"), placementFleetId: "group-1" }]);
  });

  it("lists the canonical records required by the Live projection", async () => {
    const db = client.db(`catalog_live_${Date.now()}`);
    await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.groups.save({ id: "group-1", label: "North" });
    await repos.vehicles.save(vehicle("vehicle-1"));
    await repos.connections.save({ id: "connection-1", providerId: "provider-1", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 });
    await repos.contributions.save({ id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" });
    await repos.grants.save({ organizationId: "organization-1", vehicleId: "vehicle-1" });
    const now = new Date();
    await db.collection("capability_policies").insertOne({ schemaVersion: 1, id: "gps", capability: "gps", sourceOrder: ["provider-1"], createdAt: now, updatedAt: now });

    await expect(repos.groups.list()).resolves.toEqual([{ id: "group-1", label: "North" }]);
    await expect(repos.vehicles.list()).resolves.toEqual([vehicle("vehicle-1")]);
    await expect(repos.connections.listEnabled()).resolves.toHaveLength(1);
    await expect(repos.contributions.listByConnectionId("connection-1")).resolves.toHaveLength(1);
    await expect(repos.grants.listByOrganizationId("organization-1")).resolves.toEqual([{ organizationId: "organization-1", vehicleId: "vehicle-1" }]);
    await expect(repos.policies.list()).resolves.toEqual([{ id: "gps", capability: "gps", sourceOrder: ["provider-1"] }]);
  });
  it("initializes only the definitive strict collections and indexes idempotently", async () => {
    const db = client.db(`catalog_${Date.now()}`);
    await initializeCatalogDatabase(db);
    await initializeCatalogDatabase(db);
    expect(new Set(await db.listCollections({}, { nameOnly: true }).map(({ name }) => name).toArray())).toEqual(new Set(catalogCollectionNames));
    for (const [name, indexes] of Object.entries(catalogIndexes)) {
      const actual = await db.collection(name).indexes();
      for (const { key, options } of indexes) expect(actual).toContainEqual(expect.objectContaining({ key, ...options }));
    }
    const now = new Date();
    await expect(db.collection("catalog_vehicles").insertOne({ schemaVersion: 1, id: "bad", normalizedPlate: "ABC", plate: "ABC", placementFleetId: "fleet", createdAt: now, updatedAt: now, organizationId: "org" } as never)).rejects.toThrow();
    await expect(db.collection("provider_contributions").insertOne({ schemaVersion: 1, id: "bad", connectionId: "c", externalId: "e", vehicleId: "v", capabilities: { gps: "invalid" }, presence: "present", createdAt: now, updatedAt: now } as never)).rejects.toThrow();
  });

  it("enforces catalog identity and contribution uniqueness without tenant identity", async () => {
    const db = client.db(`catalog_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.vehicles.save(vehicle("one"));
    await expect(repos.vehicles.save(vehicle("two"))).rejects.toThrow();
    await repos.contributions.save({ id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: "one", capabilities: { video: "eligible" }, presence: "present" });
    await expect(repos.contributions.save({ id: "contribution-2", connectionId: "connection-1", externalId: "external-1", vehicleId: "one", capabilities: {}, presence: "present" })).rejects.toThrow();
  });

  it("keeps concurrent idempotent writes atomic", async () => {
    const db = client.db(`catalog_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    const writes = await Promise.all(Array.from({ length: 8 }, () => repos.vehicles.save(vehicle("same"))));
    expect(writes).toHaveLength(8);
    expect(await db.collection("catalog_vehicles").countDocuments({ id: "same" })).toBe(1);
    expect(await repos.vehicles.findById("same")).toEqual(vehicle("same"));
  });

  it("writes provider contributions atomically while preserving their catalog vehicle link", async () => {
    const db = client.db(`catalog_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" });
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "absent" });
    await expect(repos.contributions.findByConnectionAndExternalId("connection", "external")).resolves.toEqual({ id: "contribution", connectionId: "connection", externalId: "external", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "absent" });
  });

  it("keeps provider definitions and connections catalog-wide and lists only enabled connections", async () => {
    const db = client.db(`catalog_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.providers.save({ id: "provider", adapterKey: "adapter", capabilities: ["gps", "video"] });
    await repos.connections.save({ id: "enabled", providerId: "provider", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 });
    await repos.connections.save({ id: "disabled", providerId: "provider", credentialRef: "vault:provider", enabled: false, cadenceMinutes: 60 });

    await expect(repos.providers.findByAdapterKey("adapter")).resolves.toEqual({ id: "provider", adapterKey: "adapter", capabilities: ["gps", "video"] });
    await expect(repos.connections.listEnabled()).resolves.toEqual([{ id: "enabled", providerId: "provider", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 }]);
  });

  it("stores independent memberships for the same vehicle and provider fleet", async () => {
    const db = client.db(`catalog_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.memberships.save({ connectionId: "connection-a", externalFleetId: "fleet", vehicleId: "vehicle", label: "North" });
    await repos.memberships.save({ connectionId: "connection-b", externalFleetId: "fleet", vehicleId: "vehicle", label: "Night" });

    await expect(repos.memberships.listByVehicleId("vehicle")).resolves.toEqual([
      { connectionId: "connection-a", externalFleetId: "fleet", vehicleId: "vehicle", label: "North" },
      { connectionId: "connection-b", externalFleetId: "fleet", vehicleId: "vehicle", label: "Night" },
    ]);
  });

  it("converges concurrent matcher transactions through unique identity indexes", async () => {
    const db = client.db(`catalog_match_race_${Date.now()}`);
    await initializeCatalogDatabase(db);
    let sequence = 0;
    const candidate: ProviderCandidate = { connectionId: "connection", externalId: "external", plate: "ABC 123", normalizedPlate: "ABC123", placementFleetId: "fleet", capabilities: { gps: "eligible" }, presence: "present" };
    const createDependencies = (): MatchAndApplyDependencies => ({
      candidate,
      ids: { create: () => `id-${++sequence}` },
      vehicles: undefined as never,
      contributions: undefined as never,
      reviews: undefined as never,
      transactions: {
        isConflict: (error) => typeof error === "object" && error !== null && "code" in error && error.code === 11000,
        run: async (work) => {
          const session = client.startSession();
          try {
            let result;
            await session.withTransaction(async () => { result = await work(createCatalogRepositories(db, session)); });
            return result as Awaited<ReturnType<typeof work>>;
          } finally { await session.endSession(); }
        },
      },
    });

    const results = await Promise.all([matchAndApplyProviderCandidate(createDependencies()), matchAndApplyProviderCandidate(createDependencies())]);

    expect(results.every((result) => result.kind === "created" || result.kind === "reused")).toBe(true);
    expect(await db.collection("catalog_vehicles").countDocuments({ normalizedPlate: "ABC123" })).toBe(1);
    expect(await db.collection("provider_contributions").countDocuments({ connectionId: "connection", externalId: "external" })).toBe(1);
  }, 60_000);

  it("converges different external identities competing for one catalog plate", async () => {
    const db = client.db(`catalog_cross_identity_race_${Date.now()}`);
    await initializeCatalogDatabase(db);
    let sequence = 0;
    const createDependencies = (externalId: string): MatchAndApplyDependencies => ({
      candidate: { connectionId: "connection", externalId, plate: "ABC 123", normalizedPlate: "ABC123", placementFleetId: "fleet", capabilities: { gps: "eligible" }, presence: "present" },
      ids: { create: () => `id-${++sequence}` },
      vehicles: undefined as never,
      contributions: undefined as never,
      reviews: undefined as never,
      transactions: {
        isConflict: (error) => typeof error === "object" && error !== null && "code" in error && error.code === 11000,
        run: async (work) => {
          const session = client.startSession();
          try {
            let result;
            await session.withTransaction(async () => { result = await work(createCatalogRepositories(db, session)); });
            return result as Awaited<ReturnType<typeof work>>;
          } finally { await session.endSession(); }
        },
      },
    });

    const results = await Promise.all([matchAndApplyProviderCandidate(createDependencies("external-a")), matchAndApplyProviderCandidate(createDependencies("external-b"))]);

    expect(results.every((result) => result.kind === "created" || result.kind === "matched")).toBe(true);
    expect(new Set(results.map((result) => result.kind === "review" ? "review" : result.vehicleId)).size).toBe(1);
    expect(await db.collection("catalog_vehicles").countDocuments({ normalizedPlate: "ABC123" })).toBe(1);
    expect(await db.collection("provider_contributions").countDocuments({ connectionId: "connection" })).toBe(2);
  }, 60_000);

  it("persists canonical groups, evidence bindings, placement provenance, and ambiguity indexes", async () => {
    const db = client.db(`catalog_groups_test_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.groups.save({ id: "group-1", label: "North" });
    await repos.evidenceBindings.save({ id: "binding-1", groupId: "group-1", evidence: { connectionId: "c", kind: "company-label", externalKey: "north", label: "North", authority: "authoritative" } });
    await repos.vehicles.save({ id: "vehicle-1", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "group-1", placement: { groupId: "group-1", authority: "authoritative", evidenceBindingId: "binding-1", assignedAt: new Date() } });
    expect(await repos.groups.findById("group-1")).toEqual({ id: "group-1", label: "North" });
    expect((await repos.evidenceBindings.findByGroupId("group-1"))[0].evidence.externalKey).toBe("north");
    expect((await db.collection("group_evidence_bindings").indexes()).some((index) => index.name === "group_evidence_bindings_evidence_unique")).toBe(true);
  });

  it("resolves groups by normalized label so equivalent spellings reach the ambiguity review", async () => {
    const db = client.db(`catalog_group_label_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.groups.save({ id: "group-1", label: "North Hub" });
    await repos.groups.save({ id: "group-2", label: "north-hub" });
    await repos.groups.save({ id: "group-3", label: "South Hub" });

    await expect(repos.groups.findByLabel("  NÓRTH  HUB ")).resolves.toEqual([
      { id: "group-1", label: "North Hub" },
      { id: "group-2", label: "north-hub" },
    ]);
    await expect(repos.groups.findByLabel("South Hub")).resolves.toEqual([{ id: "group-3", label: "South Hub" }]);
    expect((await db.collection("catalog_groups").indexes()).some((index) => index.name === "catalog_groups_normalized_label_lookup")).toBe(true);
  });

  it("persists ambiguity reviews with evidence and candidate groups", async () => {
    const db = client.db(`catalog_review_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.reviews.save({ id: "review-1", subject: "vehicle-identity", connectionId: "connection", externalId: "vehicle", reason: "ambiguous-group-evidence", evidenceKey: "fleet-label:north", candidateGroupIds: ["group-a", "group-b"], candidateVehicleIds: [], status: "pending" });

    await expect(repos.reviews.findById("review-1")).resolves.toEqual({ id: "review-1", subject: "vehicle-identity", connectionId: "connection", externalId: "vehicle", reason: "ambiguous-group-evidence", evidenceKey: "fleet-label:north", candidateGroupIds: ["group-a", "group-b"], candidateVehicleIds: [], status: "pending" });
    await expect(db.collection("catalog_reviews").findOne({ id: "review-1" })).resolves.toEqual(expect.objectContaining({ evidenceKey: "fleet-label:north", candidateGroupIds: ["group-a", "group-b"] }));
  });
});
