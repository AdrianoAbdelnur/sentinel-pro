import { describe, expect, it } from "vitest";

import { createCatalogVehicle, normalizeGroupLabel, type GroupEvidenceBinding, type ProviderContribution, type CatalogGroup } from "@/domain/catalog";
import { matchAndApplyProviderCandidate, type MatchAndApplyDependencies, type ProviderCandidate } from "./match-and-apply-provider-candidate";

const createFixture = () => {
  const vehicles = new Map<string, ReturnType<typeof createCatalogVehicle>>();
  const contributions = new Map<string, ProviderContribution>();
  const reviews: unknown[] = [];
  let sequence = 0;
  let transaction: Promise<void> = Promise.resolve();
  const dependencies: Omit<MatchAndApplyDependencies, "candidate"> = {
    vehicles: {
      findByNormalizedPlate: async (plate) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate),
      save: async (vehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    contributions: {
      findByConnectionAndExternalId: async (connectionId, externalId) => [...contributions.values()].find((value) => value.connectionId === connectionId && value.externalId === externalId),
      save: async (contribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); },
    },
    reviews: {
      findByConnectionAndExternalId: async (connectionId, externalId) => reviews.find((review) => (review as { connectionId: string; externalId: string; status: string }).connectionId === connectionId && (review as { connectionId: string; externalId: string; status: string }).externalId === externalId && (review as { connectionId: string; externalId: string; status: string }).status === "pending") as never,
      save: async (review) => { reviews.push(review); },
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
  return { dependencies, vehicles, contributions, reviews };
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
  it("reuses a plate across providers and moves a Howen-first vehicle to authoritative evidence", async () => {
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
    expect(fixture.vehicles.get(howen.kind === "review" ? "" : howen.vehicleId)?.placementFleetId).not.toBe(howenGroupId);
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

  it("keeps repeated authoritative Cybermapa evidence idempotent after Howen-first import", async () => {
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
    expect(fixture.vehicles.get(firstHowen.kind === "review" ? "" : firstHowen.vehicleId)?.placement?.authority).toBe("authoritative");
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
    ["conflicting evidence", { identityConflict: true }],
  ])("retains unsafe %s for review without creating identity", async (_name, overrides) => {
    const fixture = createFixture();

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate(overrides) });

    expect(result.kind).toBe("review");
    expect(fixture.vehicles).toHaveLength(0);
    expect(fixture.contributions).toHaveLength(0);
    expect(fixture.reviews).toHaveLength(1);
  });

  it("reuses an existing pending review when unsafe evidence is retried", async () => {
    const fixture = createFixture();
    const unsafe = { ...fixture.dependencies, candidate: candidate({ normalizedPlate: undefined }) };

    const first = await matchAndApplyProviderCandidate(unsafe);
    const second = await matchAndApplyProviderCandidate(unsafe);

    expect(second).toEqual(first);
    expect(fixture.reviews).toHaveLength(1);
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
