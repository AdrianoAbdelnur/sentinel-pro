import { describe, expect, it } from "vitest";

import { createGlobalVehicle, type ProviderContribution } from "@/domain/catalog-global";
import { matchAndApplyProviderCandidate, type MatchAndApplyDependencies, type ProviderCandidate } from "./match-and-apply-provider-candidate";

const createFixture = () => {
  const vehicles = new Map<string, ReturnType<typeof createGlobalVehicle>>();
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
  it("reuses an existing external identity before evaluating plate evidence", async () => {
    const fixture = createFixture();
    const vehicle = createGlobalVehicle({ id: "vehicle-1", normalizedPlate: "OTHER1", plate: "OTHER 1", placementFleetId: "fleet-1" });
    fixture.vehicles.set(vehicle.id, vehicle);
    fixture.contributions.set("connection-1:external-1", { id: "contribution-1", connectionId: "connection-1", externalId: "external-1", vehicleId: vehicle.id, capabilities: {}, presence: "present" });

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate({ normalizedPlate: "ABC123" }) });

    expect(result.kind).toBe("reused");
    expect(result.kind).not.toBe("review");
    if (result.kind !== "review") expect(result.vehicleId).toBe("vehicle-1");
    expect(fixture.vehicles).toHaveLength(1);
  });

  it("links a candidate to one exact global normalized plate", async () => {
    const fixture = createFixture();
    const vehicle = createGlobalVehicle({ id: "vehicle-1", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "sentinel-1" });
    fixture.vehicles.set(vehicle.id, vehicle);

    const result = await matchAndApplyProviderCandidate({ ...fixture.dependencies, candidate: candidate() });

    expect(result).toMatchObject({ kind: "matched", vehicleId: "vehicle-1" });
    expect(fixture.contributions.get("connection-1:external-1")).toMatchObject({ vehicleId: "vehicle-1" });
    expect(fixture.vehicles.get("vehicle-1")?.placementFleetId).toBe("sentinel-1");
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
