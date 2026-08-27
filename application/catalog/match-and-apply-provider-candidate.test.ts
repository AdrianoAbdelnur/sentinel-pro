import { describe, expect, it } from "vitest";

import { createCatalogVehicle, normalizeGroupLabel, type CatalogDevice, type GroupEvidenceBinding, type ProviderContribution, type CatalogGroup, type ProviderVehicleObservation } from "@/domain/catalog";
import { matchAndApplyProviderCandidate, type MatchAndApplyDependencies, type ProviderCandidate } from "./match-and-apply-provider-candidate";

const createFixture = () => {
  const vehicles = new Map<string, ReturnType<typeof createCatalogVehicle>>();
  const contributions = new Map<string, ProviderContribution>();
  const devices = new Map<string, CatalogDevice>();
  const observations = new Map<string, ProviderVehicleObservation>();
  const memberships = new Map<string, { connectionId: string; externalFleetId: string; vehicleId: string; label: string }>();
  const reviews: unknown[] = [];
  let sequence = 0;
  let transaction: Promise<void> = Promise.resolve();
  const dependencies: Omit<MatchAndApplyDependencies, "candidate"> = {
    vehicles: {
      findById: async (id) => vehicles.get(id),
      findByNormalizedPlate: async (plate) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate),
      findAllByNormalizedPlate: async (plate) => [...vehicles.values()].filter((vehicle) => vehicle.normalizedPlate === plate),
      save: async (vehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    devices: {
      findByConnectionAndDeviceId: async (connectionId, deviceId) => devices.get(`${connectionId}:${deviceId}`),
      listByVehicleId: async (vehicleId) => [...devices.values()].filter((device) => device.vehicleId === vehicleId),
      save: async (device) => { devices.set(`${device.connectionId}:${device.deviceId}`, device); },
    },
    contributions: {
      findByConnectionAndExternalId: async (connectionId, externalId) => [...contributions.values()].find((value) => value.connectionId === connectionId && value.externalId === externalId),
      save: async (contribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); },
    },
    reviews: {
      findByConnectionAndExternalId: async (connectionId, externalId) => reviews.find((review) => (review as { connectionId: string; externalId: string; status: string }).connectionId === connectionId && (review as { connectionId: string; externalId: string; status: string }).externalId === externalId && (review as { connectionId: string; externalId: string; status: string }).status === "pending") as never,
      save: async (review) => { reviews.push(review); },
    },
    observations: {
      save: async (observation) => { observations.set(observation.contributionId, observation); },
      listByVehicleId: async (vehicleId) => [...observations.values()].filter((observation) => [...contributions.values()].some((contribution) => contribution.id === observation.contributionId && contribution.vehicleId === vehicleId)),
    },
    memberships: {
      save: async (membership) => { memberships.set(`${membership.connectionId}:${membership.vehicleId}`, membership); },
      replaceCurrent: async (membership) => { memberships.set(`${membership.connectionId}:${membership.vehicleId}`, membership); },
      clearCurrent: async (connectionId, vehicleId) => { memberships.delete(`${connectionId}:${vehicleId}`); },
    },
    ids: { create: () => `id-${++sequence}` },
    transactions: {
      run: async (work) => {
        let release!: () => void;
        const previous = transaction;
        transaction = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try { return await work(dependencies); } finally { release(); }
      },
      isConflict: (error) => error instanceof Error && error.message === "conflict",
    },
  };
  return { dependencies, vehicles, contributions, devices, observations, memberships, reviews };
};

const candidate = (overrides: Partial<ProviderCandidate> = {}): ProviderCandidate => ({
  connectionId: "connection-1",
  externalId: "external-1",
  plate: "ABC 123",
  normalizedPlate: "ABC123",
  placementFleetId: "fleet-1",
  capabilities: { video: "eligible" },
  presence: "present",
  ...overrides,
});

describe("matchAndApplyProviderCandidate", () => {
  it("reuses a plate across providers without moving the first contribution's placement", async () => {
    const fixture = createFixture();
    const groups = new Map<string, { id: string; label: string }>();
    const bindings = new Map<string, { id: string; groupId: string; evidence: { connectionId: string; kind: "company-label" | "fleet-membership"; externalKey: string; label: string; authority: "authoritative" | "fallback" } }>();
    const repositories = {
      ...fixture.dependencies,
      groups: {
        findById: async (id: string) => groups.get(id),
        findByLabel: async (label: string) => [...groups.values()].filter((group) => group.label === label),
        save: async (group: { id: string; label: string }) => { groups.set(group.id, group); },
      },
      evidenceBindings: {
        findById: async (id: string) => bindings.get(id),
        findByGroupId: async (groupId: string) => [...bindings.values()].filter((binding) => binding.groupId === groupId),
        findByEvidence: async (connectionId: string, kind: string, externalKey: string) => [...bindings.values()].filter((binding) => binding.evidence.connectionId === connectionId && binding.evidence.kind === kind && binding.evidence.externalKey === externalKey),
        save: async (binding: typeof bindings extends Map<string, infer V> ? V : never) => { bindings.set(binding.id, binding); },
      },
    };
    repositories.transactions.run = async (work) => work(repositories);
    const howen = await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ placementFleetId: undefined, groupEvidence: { connectionId: "howen", kind: "fleet-membership", externalKey: "h1", label: "Howen", authority: "fallback" } }) });
    const howenGroupId = howen.kind === "review" ? "" : fixture.vehicles.get(howen.vehicleId)?.placementFleetId;
    const cybermapa = await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ connectionId: "cyber", externalId: "cyber-1", groupEvidence: { connectionId: "cyber", kind: "company-label", externalKey: "acme", label: "Acme", authority: "authoritative" } }) });
    expect(howen.kind).toBe("created");
    expect(cybermapa).toMatchObject({ kind: "matched", vehicleId: howen.kind === "review" ? "" : howen.vehicleId });
    expect(fixture.vehicles.get(howen.kind === "review" ? "" : howen.vehicleId)?.placementFleetId).toBe(howenGroupId);
    expect(groups).toHaveLength(2);
  });

  it("creates no duplicate group or vehicle on repeated fallback evidence", async () => {
    const fixture = createFixture();
    const groups = new Map<string, { id: string; label: string }>();
    const bindings = new Map<string, GroupEvidenceBinding>();
    const repositories = { ...fixture.dependencies, groups: { findById: async (id: string) => groups.get(id), findByLabel: async () => [], save: async (group: CatalogGroup) => { groups.set(group.id, group); } }, evidenceBindings: { findById: async (id: string) => bindings.get(id), findByGroupId: async () => [], findByEvidence: async (connectionId: string, kind: string, externalKey: string) => [...bindings.values()].filter((binding) => binding.evidence.connectionId === connectionId && binding.evidence.kind === kind && binding.evidence.externalKey === externalKey), save: async (binding: GroupEvidenceBinding) => { bindings.set(binding.id, binding); } } };
    repositories.transactions.run = async (work) => work(repositories);
    const input = { ...repositories, candidate: candidate({ placementFleetId: undefined, groupEvidence: { connectionId: "howen", kind: "fleet-membership" as const, externalKey: "h1", label: "Howen", authority: "fallback" as const } }) };
    await matchAndApplyProviderCandidate(input);
    await matchAndApplyProviderCandidate(input);
    expect(fixture.vehicles).toHaveLength(1);
    expect(groups).toHaveLength(1);
  });

  it("keeps repeated authoritative Cybermapa evidence idempotent without replacing Howen-first placement", async () => {
    const fixture = createFixture();
    const groups = new Map<string, CatalogGroup>();
    const bindings = new Map<string, GroupEvidenceBinding>();
    const repositories = {
      ...fixture.dependencies,
      groups: { findById: async (id: string) => groups.get(id), findByLabel: async (label: string) => [...groups.values()].filter((group) => group.label === label), save: async (group: CatalogGroup) => { groups.set(group.id, group); } },
      evidenceBindings: { findById: async (id: string) => bindings.get(id), findByGroupId: async () => [], findByEvidence: async (connectionId: string, kind: string, externalKey: string) => [...bindings.values()].filter((binding) => binding.evidence.connectionId === connectionId && binding.evidence.kind === kind && binding.evidence.externalKey === externalKey), save: async (binding: GroupEvidenceBinding) => { bindings.set(binding.id, binding); } },
    };
    repositories.transactions.run = async (work) => work(repositories);
    const howen = { ...repositories, candidate: candidate({ connectionId: "howen", externalId: "howen-1", placementFleetId: undefined, groupEvidence: { connectionId: "howen", kind: "fleet-membership", externalKey: "h1", label: "Howen", authority: "fallback" } }) };
    const cybermapa = { ...repositories, candidate: candidate({ connectionId: "cyber", externalId: "cyber-1", groupEvidence: { connectionId: "cyber", kind: "company-label", externalKey: "acme", label: "Acme", authority: "authoritative" } }) };

    const firstHowen = await matchAndApplyProviderCandidate(howen);
    await matchAndApplyProviderCandidate(cybermapa);
    await matchAndApplyProviderCandidate(cybermapa);

    expect(fixture.vehicles).toHaveLength(1);
    expect(groups).toHaveLength(2);
    expect(fixture.contributions).toHaveLength(2);
    expect(fixture.vehicles.get(firstHowen.kind === "review" ? "" : firstHowen.vehicleId)?.placement?.authority).toBe("fallback");
  });

  it("preserves authoritative Cybermapa placement when it arrives before Howen fallback evidence", async () => {
    const fixture = createFixture();
    const groups = new Map<string, CatalogGroup>();
    const bindings = new Map<string, GroupEvidenceBinding>();
    const repositories = {
      ...fixture.dependencies,
      groups: {
        findById: async (id: string) => groups.get(id),
        findByLabel: async (label: string) => [...groups.values()].filter((group) => group.label === label),
        save: async (group: CatalogGroup) => { groups.set(group.id, group); },
      },
      evidenceBindings: {
        findById: async (id: string) => bindings.get(id),
        findByGroupId: async (groupId: string) => [...bindings.values()].filter((binding) => binding.groupId === groupId),
        findByEvidence: async (connectionId: string, kind: string, externalKey: string) => [...bindings.values()].filter((binding) => binding.evidence.connectionId === connectionId && binding.evidence.kind === kind && binding.evidence.externalKey === externalKey),
        save: async (binding: GroupEvidenceBinding) => { bindings.set(binding.id, binding); },
      },
    };
    repositories.transactions.run = async (work) => work(repositories);

    const cybermapa = await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ connectionId: "cyber", externalId: "cyber-1", groupEvidence: { connectionId: "cyber", kind: "company-label", externalKey: "acme", label: "Acme", authority: "authoritative" } }) });
    const howen = await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ connectionId: "howen", externalId: "howen-1", placementFleetId: undefined, groupEvidence: { connectionId: "howen", kind: "fleet-membership", externalKey: "h1", label: "Howen", authority: "fallback" } }) });

    expect(cybermapa.kind).toBe("created");
    expect(howen).toMatchObject({ kind: "matched", vehicleId: cybermapa.kind === "review" ? "" : cybermapa.vehicleId });
    expect(fixture.vehicles.get(cybermapa.kind === "review" ? "" : cybermapa.vehicleId)?.placement).toMatchObject({ authority: "authoritative" });
  });

  it("creates an ambiguity review when normalized group evidence matches multiple groups", async () => {
    const fixture = createFixture();
    const groups = new Map<string, CatalogGroup>([
      ["group-1", { id: "group-1", label: "North Hub" }],
      ["group-2", { id: "group-2", label: "North-Hub" }],
    ]);
    const bindings = new Map<string, GroupEvidenceBinding>();
    const repositories = {
      ...fixture.dependencies,
      groups: {
        findById: async (id: string) => groups.get(id),
        findByLabel: async (label: string) => [...groups.values()].filter((group) => normalizeGroupLabel(group.label) === normalizeGroupLabel(label)),
        save: async (group: CatalogGroup) => { groups.set(group.id, group); },
      },
      evidenceBindings: {
        findById: async (id: string) => bindings.get(id),
        findByGroupId: async (groupId: string) => [...bindings.values()].filter((binding) => binding.groupId === groupId),
        findByEvidence: async () => [],
        save: async (binding: GroupEvidenceBinding) => { bindings.set(binding.id, binding); },
      },
    };
    repositories.transactions.run = async (work) => work(repositories);

    const result = await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ groupEvidence: { connectionId: "howen", kind: "fleet-membership", externalKey: "north", label: "North Hub", authority: "fallback" } }) });

    expect(result.kind).toBe("review");
    if (result.kind === "review") expect(result.review).toMatchObject({ reason: "ambiguous-group-evidence", candidateGroupIds: ["group-1", "group-2"] });
    expect(fixture.vehicles).toHaveLength(0);
  });

  it("updates the stored evidence label upstream without creating a second group", async () => {
    const fixture = createFixture();
    const groups = new Map<string, CatalogGroup>();
    const bindings = new Map<string, GroupEvidenceBinding>();
    const repositories = {
      ...fixture.dependencies,
      groups: {
        findById: async (id: string) => groups.get(id),
        findByLabel: async (label: string) => [...groups.values()].filter((group) => normalizeGroupLabel(group.label) === normalizeGroupLabel(label)),
        save: async (group: CatalogGroup) => { groups.set(group.id, group); },
      },
      evidenceBindings: {
        findById: async (id: string) => bindings.get(id),
        findByGroupId: async (groupId: string) => [...bindings.values()].filter((binding) => binding.groupId === groupId),
        findByEvidence: async (connectionId: string, kind: string, externalKey: string) => [...bindings.values()].filter((binding) => binding.evidence.connectionId === connectionId && binding.evidence.kind === kind && binding.evidence.externalKey === externalKey),
        save: async (binding: GroupEvidenceBinding) => { bindings.set(binding.id, binding); },
      },
    };
    repositories.transactions.run = async (work) => work(repositories);
    const evidence = (label: string) => ({ connectionId: "howen", kind: "fleet-membership" as const, externalKey: "north", label, authority: "fallback" as const });

    await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ groupEvidence: evidence("North Hub") }) });
    const stableGroupId = [...groups.keys()][0];
    await matchAndApplyProviderCandidate({ ...repositories, candidate: candidate({ externalId: "external-2", plate: "XYZ 789", normalizedPlate: "XYZ789", groupEvidence: evidence("North Hub Renamed") }) });

    expect([...groups.values()]).toHaveLength(1);
    expect([...bindings.values()]).toHaveLength(1);
    expect([...bindings.values()][0]).toMatchObject({ groupId: stableGroupId, evidence: { label: "North Hub Renamed", externalKey: "north" } });
    expect([...fixture.vehicles.values()].map((vehicle) => vehicle.placementFleetId)).toEqual([stableGroupId, stableGroupId]);
  });

  it("reuses an existing external identity before evaluating plate evidence", async () => {
    const fixture = createFixture();
    const vehicle = createCatalogVehicle({ id: "vehicle-1", normalizedPlate: "OTHER1", plate: "OTHER 1", placementFleetId: "fleet-1" });
    fixture.vehicles.set(vehicle.id, vehicle);
    fixture.contributions.set("connection-1:external-1", { id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: vehicle.id, capabilities: {}, presence: "present" });

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ normalizedPlate: "ABC123" }) });

    expect(result.kind).toBe("reused");
    expect(result.kind).not.toBe("review");
    if (result.kind !== "review") expect(result.vehicleId).toBe("vehicle-1");
    expect(fixture.vehicles).toHaveLength(1);
  });

  it("links a candidate to one exact catalog normalized plate", async () => {
    const fixture = createFixture();
    const vehicle = createCatalogVehicle({ id: "vehicle-1", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "group-1" });
    fixture.vehicles.set(vehicle.id, vehicle);

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() });

    expect(result).toMatchObject({ kind: "matched", vehicleId: "vehicle-1" });
    expect(fixture.contributions.get("connection-1:external-1")).toMatchObject({ vehicleId: "vehicle-1" });
    expect(fixture.vehicles.get("vehicle-1")?.placementFleetId).toBe("group-1");
  });

  it.each([
    ["missing plate", { normalizedPlate: undefined }],
    ["malformed plate", { normalizedPlate: "ABC 123" }],
  ])("creates a normal identity for %s when the device identity is valid", async (_name, overrides) => {
    const fixture = createFixture();

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate(overrides) });

    expect(result.kind).toBe("created");
    expect(fixture.vehicles).toHaveLength(1);
    expect(fixture.contributions).toHaveLength(1);
    expect(fixture.reviews).toHaveLength(0);
  });

  it("keeps an existing identity linked and creates review when a later plate points to another vehicle", async () => {
    const fixture = createFixture();
    const linked = createCatalogVehicle({ id: "vehicle-linked", normalizedPlate: "OTHER1", plate: "OTHER 1", placementFleetId: "fleet-1" });
    const plateMatch = createCatalogVehicle({ id: "vehicle-plate", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "fleet-2" });
    fixture.vehicles.set(linked.id, linked);
    fixture.vehicles.set(plateMatch.id, plateMatch);
    fixture.contributions.set("connection-1:external-1", { id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: linked.id, capabilities: {}, presence: "present" });

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() });

    expect(result).toMatchObject({ kind: "review", review: { reason: "conflicting-identity", candidateVehicleIds: ["vehicle-linked", "vehicle-plate"] } });
    expect(fixture.contributions.get("connection-1:external-1")?.vehicleId).toBe("vehicle-linked");
    expect(fixture.vehicles).toHaveLength(2);
  });

  it("creates separate vehicles for plate-less devices from different connections", async () => {
    const fixture = createFixture();

    const first = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ connectionId: "connection-a", externalId: "device-a", plate: undefined, normalizedPlate: undefined }) });
    const second = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ connectionId: "connection-b", externalId: "device-b", plate: undefined, normalizedPlate: undefined }) });

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("created");
    expect(fixture.vehicles).toHaveLength(2);
    expect(new Set([...fixture.contributions.values()].map((value) => value.vehicleId))).toHaveLength(2);
  });

  it("persists one durable device per provider when two providers share a vehicle", async () => {
    const fixture = createFixture();

    const cybermapa = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ connectionId: "cybermapa", externalId: "gps", deviceId: "gps", device: { kind: "gps", status: "active" } }) });
    const howen = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ connectionId: "howen", externalId: "mdvr", deviceId: "mdvr", device: { kind: "mdvr", status: "inactive" } }) });

    expect(cybermapa.kind).toBe("created");
    expect(howen).toMatchObject({ kind: "matched", vehicleId: cybermapa.kind === "review" ? "" : cybermapa.vehicleId });
    expect([...fixture.devices.values()]).toMatchObject([
      { connectionId: "cybermapa", deviceId: "gps", vehicleId: cybermapa.kind === "review" ? "" : cybermapa.vehicleId },
      { connectionId: "howen", deviceId: "mdvr", vehicleId: cybermapa.kind === "review" ? "" : cybermapa.vehicleId },
    ]);
  });

  it("resolves an eligible legacy review through an existing identity without relinking", async () => {
    const fixture = createFixture();
    const vehicle = createCatalogVehicle({ id: "vehicle-linked", normalizedPlate: "OLD123", plate: "OLD123", placementFleetId: "fleet" });
    fixture.vehicles.set(vehicle.id, vehicle);
    fixture.contributions.set("connection-1:external-1", { id: "contribution", connectionId: "connection-1", externalId: "external-1", deviceId: "external-1", vehicleId: vehicle.id, capabilities: {}, presence: "present" });
    fixture.reviews.push({ id: "legacy", subject: "vehicle-identity", connectionId: "connection-1", externalId: "external-1", reason: "missing-plate", candidateVehicleIds: [], status: "pending" });

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ plate: "NEW456", normalizedPlate: "NEW456" }) });

    expect(result).toMatchObject({ kind: "reused", vehicleId: "vehicle-linked" });
    expect(fixture.contributions.get("connection-1:external-1")?.vehicleId).toBe("vehicle-linked");
    expect(fixture.reviews.at(-1)).toMatchObject({ id: "legacy", status: "resolved", resolvedVehicleId: "vehicle-linked" });
  });

  it("does not activate a vehicle from presence without an explicit active device status", async () => {
    const fixture = createFixture();

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ device: { kind: "gps" } }) });

    expect(result.kind).toBe("created");
    expect(fixture.vehicles.get(result.kind === "review" ? "" : result.vehicleId)?.active).toBe(false);
  });

  it("replaces mutable provider facts and current membership on a repeated device identity", async () => {
    const fixture = createFixture();
    const first = candidate({ deviceId: "device", observation: { providerKey: "howen", company: "Old", name: "Old", companyResolution: "direct", observedAt: new Date("2026-08-25T10:00:00.000Z") }, providerFleetMembership: { externalFleetId: "old", label: "Old" }, device: { kind: "mdvr", model: "M1", status: "inactive" } });
    const changed = candidate({ deviceId: "device", observation: { providerKey: "howen", company: "New", name: "New", make: "Ford", companyResolution: "ancestor", observedAt: new Date("2026-08-25T11:00:00.000Z") }, providerFleetMembership: { externalFleetId: "new", label: "New" }, device: { kind: "mdvr", model: "M2", status: "active" }, capabilities: { gps: "eligible", video: "stale" } });

    const created = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: first });
    await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: changed });
    const vehicleId = created.kind === "review" ? "" : created.vehicleId;

    expect(fixture.devices.get("connection-1:device")).toMatchObject({ model: "M2", status: "active", capabilities: { gps: "eligible", video: "stale" } });
    expect(fixture.observations.values().next().value).toMatchObject({ company: "New", name: "New", make: "Ford", companyResolution: "ancestor" });
    expect(fixture.memberships.get(`connection-1:${vehicleId}`)).toMatchObject({ externalFleetId: "new", label: "New" });
    expect(fixture.vehicles.get(vehicleId)).toMatchObject({ company: "New", name: "New", make: "Ford", active: true });
  });

  it("keeps conflicting device and contribution links pending without rewriting either link", async () => {
    const fixture = createFixture();
    fixture.dependencies.devices = { findByConnectionAndDeviceId: async () => ({ id: "device-1", vehicleId: "vehicle-device", connectionId: "connection-1", deviceId: "external-1", capabilities: {}, presence: "present" }), save: async () => undefined };
    fixture.contributions.set("connection-1:external-1", { id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: "vehicle-contribution", capabilities: {}, presence: "present" });
    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ deviceId: "external-1" }) });
    expect(result.kind).toBe("review");
    expect(fixture.reviews).toHaveLength(1);
    expect(fixture.contributions.get("connection-1:external-1")?.vehicleId).toBe("vehicle-contribution");
  });

  it("retains conflicting identity evidence for manual review", async () => {
    const fixture = createFixture();
    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ identityConflict: true }) });
    expect(result.kind).toBe("review");
    expect(fixture.vehicles).toHaveLength(0);
  });

  it("reuses an existing identity when a plate-less candidate is retried", async () => {
    const fixture = createFixture();
    const unsafe = { ...fixture.dependencies, candidate: candidate({ normalizedPlate: undefined }) };

    const first = await matchAndApplyProviderCandidate(unsafe);
    const second = await matchAndApplyProviderCandidate(unsafe);

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("reused");
    expect(fixture.vehicles).toHaveLength(1);
    expect(fixture.contributions).toHaveLength(1);
  });

  it("serializes concurrent candidates so one external identity and one vehicle win", async () => {
    const fixture = createFixture();

    const results = await Promise.all([
      matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() }),
      matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() }),
    ]);

    expect(new Set(results.filter((result) => result.kind !== "review").map((result) => result.vehicleId)).size).toBe(1);
    expect(fixture.vehicles).toHaveLength(1);
    expect(fixture.contributions).toHaveLength(1);
  });

  it("retries a transaction conflict and then reuses the committed external identity", async () => {
    const fixture = createFixture();
    const originalRun = fixture.dependencies.transactions.run;
    let attempts = 0;
    fixture.dependencies.transactions.run = async (work) => {
      if (attempts++ === 0) throw new Error("conflict");
      return originalRun(work);
    };

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() });

    expect(result.kind).toBe("created");
    expect(attempts).toBe(2);
  });
});
