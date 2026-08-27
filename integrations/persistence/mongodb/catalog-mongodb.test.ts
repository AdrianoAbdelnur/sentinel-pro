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

  it("keeps tenant access independent from canonical business company", async () => {
    const db = client.db(`catalog_company_access_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.vehicles.save({ ...vehicle("vehicle"), company: "Business Company" });
    await repos.grants.save({ organizationId: "tenant-organization", vehicleId: "vehicle" });

    await expect(repos.vehicles.findById("vehicle")).resolves.toMatchObject({ company: "Business Company" });
    await expect(repos.grants.find("tenant-organization", "vehicle")).resolves.toEqual({ organizationId: "tenant-organization", vehicleId: "vehicle" });
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

  it("repairs an existing catalog index when its options are outdated", async () => {
    const db = client.db(`catalog_index_upgrade_${Date.now()}`);
    await db.createCollection("catalog_vehicles");
    await db.collection("catalog_vehicles").createIndex({ normalizedPlate: 1 }, { unique: true, name: "catalog_vehicles_plate_unique" });

    await initializeCatalogDatabase(db);

    await expect(db.collection("catalog_vehicles").indexes()).resolves.toContainEqual(expect.objectContaining({ name: "catalog_vehicles_plate_unique", unique: true, sparse: true }));
  });

  it("upgrades an existing strict observation collection before enriched writes", async () => {
    const db = client.db(`catalog_upgrade_${Date.now()}`);
    const text = { bsonType: "string", minLength: 1 };
    const date = { bsonType: "date" };
    await db.createCollection("provider_vehicle_observations", { validationLevel: "strict", validationAction: "error", validator: { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["_id", "schemaVersion", "id", "contributionId", "connectionId", "deviceId", "companyResolution", "observedAt", "createdAt", "updatedAt"], properties: { _id: { bsonType: "objectId" }, schemaVersion: { bsonType: "int" }, id: text, contributionId: text, connectionId: text, deviceId: text, companyResolution: { enum: ["direct", "ancestor", "unresolved", "not-applicable"] }, observedAt: date, createdAt: date, updatedAt: date } } } });

    await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "device", vehicleId: "vehicle", capabilities: {}, presence: "present" });

    await expect(repos.observations!.save({ id: "observation", contributionId: "contribution", connectionId: "connection", deviceId: "device", providerKey: "howen", companyResolution: "direct", presence: "present", active: true, observedAt: new Date() })).resolves.toBeUndefined();
    await expect(db.collection("provider_vehicle_observations").findOne({ id: "observation" })).resolves.toMatchObject({ providerKey: "howen", presence: "present", active: true });
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

  it("round-trips current provider observations through the strict validator", async () => {
    const db = client.db(`catalog_observation_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.contributions.save({ id: "contribution", connectionId: "connection", externalId: "device", deviceId: "device", vehicleId: "vehicle", capabilities: {}, presence: "present" });
    const observation = { id: "observation", contributionId: "contribution", connectionId: "connection", deviceId: "device", providerKey: "howen", company: "Acme", companyResolution: "direct" as const, presence: "present" as const, active: true, observedAt: new Date("2026-08-25T12:00:00.000Z") };

    await repos.observations!.save(observation);

    await expect(repos.observations!.listByVehicleId!("vehicle")).resolves.toEqual([observation]);
    const replacement = { ...observation, company: undefined, active: false, observedAt: new Date("2026-08-25T13:00:00.000Z") };
    await repos.observations!.save(replacement);
    await expect(repos.observations!.listByVehicleId!("vehicle")).resolves.toEqual([replacement]);
    await expect(db.collection("provider_vehicle_observations").findOne({ contributionId: "contribution" })).resolves.not.toHaveProperty("company");
    await expect(db.collection("provider_vehicle_observations").insertOne({ ...observation, id: "invalid", providerKey: 7, schemaVersion: 1, createdAt: new Date(), updatedAt: new Date() } as never)).rejects.toThrow();
    await expect(db.collection("provider_vehicle_observations").insertOne({ ...observation, id: "invalid-extra", unexpected: true, schemaVersion: 1, createdAt: new Date(), updatedAt: new Date() } as never)).rejects.toThrow();
  });

  it("unsets canonical optional fields when reconciliation clears them", async () => {
    const db = client.db(`catalog_vehicle_unset_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.vehicles.save({ ...vehicle("vehicle", "OLD123"), name: "Old", make: "Old", model: "Old", company: "Old" });

    await repos.vehicles.save({ id: "vehicle", normalizedPlate: "", plate: "", placementFleetId: "fleet-vehicle", name: undefined, make: undefined, model: undefined, company: undefined, active: false });

    await expect(db.collection("catalog_vehicles").findOne({ id: "vehicle" })).resolves.not.toHaveProperty("plate");
    await expect(db.collection("catalog_vehicles").findOne({ id: "vehicle" })).resolves.not.toHaveProperty("normalizedPlate");
    await expect(repos.vehicles.findById("vehicle")).resolves.toEqual({ id: "vehicle", normalizedPlate: "", plate: "", placementFleetId: "fleet-vehicle", active: false });
  });

  it("replaces one connection's current fleet membership without touching another provider", async () => {
    const db = client.db(`catalog_membership_replace_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.memberships.save({ connectionId: "howen", externalFleetId: "old", vehicleId: "vehicle", label: "Old" });
    await repos.memberships.save({ connectionId: "cybermapa", externalFleetId: "company", vehicleId: "vehicle", label: "Company" });

    await repos.memberships.replaceCurrent!({ connectionId: "howen", externalFleetId: "new", vehicleId: "vehicle", label: "New" });

    await expect(repos.memberships.listByVehicleId("vehicle")).resolves.toEqual([
      { connectionId: "cybermapa", externalFleetId: "company", vehicleId: "vehicle", label: "Company" },
      { connectionId: "howen", externalFleetId: "new", vehicleId: "vehicle", label: "New" },
    ]);
  });

  it("atomically self-heals an eligible legacy review and remains idempotent", async () => {
    const db = client.db(`catalog_legacy_heal_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.reviews.save({ id: "legacy", subject: "vehicle-identity", connectionId: "connection", externalId: "device", reason: "missing-plate", candidateVehicleIds: [], status: "pending" });
    let sequence = 0;
    const dependencies = (): MatchAndApplyDependencies => ({
      candidate: { connectionId: "connection", externalId: "device", deviceId: "device", placementFleetId: "fleet", providerFleetMembership: { externalFleetId: "provider-fleet", label: "Provider Fleet" }, capabilities: { gps: "eligible" }, presence: "present", device: { kind: "gps", status: "active" }, observation: { providerKey: "cybermapa", company: "Acme", companyResolution: "direct", observedAt: new Date("2026-08-25T12:00:00.000Z") } },
      ids: { create: () => `generated-${++sequence}` }, vehicles: undefined as never, contributions: undefined as never, reviews: undefined as never,
      transactions: { isConflict: () => false, run: async (work) => { const session = client.startSession(); try { let result; await session.withTransaction(async () => { result = await work(createCatalogRepositories(db, session)); }); return result as Awaited<ReturnType<typeof work>>; } finally { await session.endSession(); } } },
    });

    const first = await matchAndApplyProviderCandidate(dependencies());
    const second = await matchAndApplyProviderCandidate(dependencies());

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("reused");
    expect(await db.collection("catalog_vehicles").countDocuments()).toBe(1);
    expect(await db.collection("catalog_devices").countDocuments()).toBe(1);
    expect(await db.collection("provider_contributions").countDocuments()).toBe(1);
    expect(await db.collection("provider_vehicle_observations").countDocuments()).toBe(1);
    expect(await db.collection("provider_fleet_memberships").countDocuments()).toBe(1);
    await expect(repos.reviews.findById("legacy")).resolves.toMatchObject({ status: "resolved", resolvedVehicleId: first.kind === "review" ? undefined : first.vehicleId });
  }, 60_000);

  it("rolls back eligible review reconciliation when review closure fails", async () => {
    const db = client.db(`catalog_legacy_rollback_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.reviews.save({ id: "legacy", subject: "vehicle-identity", connectionId: "connection", externalId: "device", reason: "malformed-plate", candidateVehicleIds: [], status: "pending" });
    const dependencies: MatchAndApplyDependencies = {
      candidate: { connectionId: "connection", externalId: "device", deviceId: "device", placementFleetId: "fleet", providerFleetMembership: { externalFleetId: "provider-fleet", label: "Provider Fleet" }, capabilities: {}, presence: "present", observation: { providerKey: "howen", companyResolution: "unresolved", observedAt: new Date() } },
      ids: { create: () => crypto.randomUUID() }, vehicles: undefined as never, contributions: undefined as never, reviews: undefined as never,
      transactions: { isConflict: () => false, run: async (work) => { const session = client.startSession(); try { let result; await session.withTransaction(async () => { const transactional = createCatalogRepositories(db, session); result = await work({ ...transactional, reviews: { ...transactional.reviews, save: async (review) => { if (review.status === "resolved") throw new Error("closure failed"); await transactional.reviews.save(review); } } }); }); return result as Awaited<ReturnType<typeof work>>; } finally { await session.endSession(); } } },
    };

    await expect(matchAndApplyProviderCandidate(dependencies)).rejects.toThrow("closure failed");

    expect(await db.collection("catalog_vehicles").countDocuments()).toBe(0);
    expect(await db.collection("catalog_devices").countDocuments()).toBe(0);
    expect(await db.collection("provider_contributions").countDocuments()).toBe(0);
    expect(await db.collection("provider_vehicle_observations").countDocuments()).toBe(0);
    expect(await db.collection("provider_fleet_memberships").countDocuments()).toBe(0);
    await expect(repos.reviews.findById("legacy")).resolves.toMatchObject({ status: "pending" });
  }, 60_000);

  it("leaves an ineligible legacy review pending without creating identity records", async () => {
    const db = client.db(`catalog_legacy_manual_${Date.now()}`); await initializeCatalogDatabase(db);
    const repos = createCatalogRepositories(db);
    await repos.reviews.save({ id: "legacy", subject: "vehicle-identity", connectionId: "connection", externalId: "device", reason: "missing-placement", candidateVehicleIds: [], status: "pending" });
    const result = await matchAndApplyProviderCandidate({ candidate: { connectionId: "connection", externalId: "device", deviceId: "device", placementFleetId: "fleet", capabilities: {}, presence: "present" }, ids: { create: () => "generated" }, vehicles: repos.vehicles, contributions: repos.contributions, reviews: repos.reviews, devices: repos.devices, observations: repos.observations, conflicts: repos.conflicts, memberships: repos.memberships, transactions: { isConflict: () => false, run: async (work) => work(repos) } });

    expect(result).toMatchObject({ kind: "review", review: { id: "legacy", status: "pending" } });
    expect(await db.collection("catalog_vehicles").countDocuments()).toBe(0);
    expect(await db.collection("provider_contributions").countDocuments()).toBe(0);
  });
});
