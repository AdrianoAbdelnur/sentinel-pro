import { describe, expect, it } from "vitest";

import type { GlobalVehicle, ProviderContribution, ProviderFleetMembership } from "@/domain/catalog-global";

import { seedHowenCatalog } from "./seed-howen-catalog";
import type { HowenRosterRecord } from "./responses";

function record(overrides: Partial<HowenRosterRecord> = {}): HowenRosterRecord {
  return {
    deviceno: "howen-device-1",
    devicename: "AB123CD",
    fleetid: "howen-fleet-1",
    fleetname: "Howen North",
    ...overrides,
  };
}

function createFixture() {
  const vehicles = new Map<string, GlobalVehicle>();
  const contributions = new Map<string, ProviderContribution>();
  const memberships = new Map<string, ProviderFleetMembership>();
  let sequence = 0;
  const repositories = {
    vehicles: {
      findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate),
      save: async (vehicle: GlobalVehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    contributions: {
      findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`),
      save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); },
    },
    memberships: {
      listByVehicleId: async (vehicleId: string) => [...memberships.values()].filter((membership) => membership.vehicleId === vehicleId),
      listByConnectionAndExternalFleet: async (connectionId: string, externalFleetId: string) => [...memberships.values()].filter((membership) => membership.connectionId === connectionId && membership.externalFleetId === externalFleetId),
      save: async (membership: ProviderFleetMembership) => { memberships.set(`${membership.connectionId}:${membership.externalFleetId}:${membership.vehicleId}`, membership); },
    },
    reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
  };
  const transactions = { run: async <T>(work: (transactionalRepositories: typeof repositories) => Promise<T>) => work(repositories), isConflict: () => false };
  const dependencies = {
    connectionId: "howen-connection",
    resolveInitialPlacementFleetId: ({ externalFleetId }: { externalFleetId: string; label: string }) => externalFleetId === "howen-fleet-1" ? "sentinel-howen-north" : undefined,
    ids: { create: () => `id-${++sequence}` },
    repositories,
    transactions,
  };
  return { ...dependencies, vehicles, contributions, memberships };
}

describe("seedHowenCatalog", () => {
  it("matches an existing global plate, adds video, preserves Sentinel placement, and persists verified Howen fleet membership", async () => {
    const fixture = createFixture();
    fixture.vehicles.set("cybermapa-vehicle", { id: "cybermapa-vehicle", normalizedPlate: "AB123CD", plate: "AB 123 CD", placementFleetId: "sentinel-cybermapa" });

    const result = await seedHowenCatalog({ ...fixture, records: [record()] });

    expect(result.outcomes).toMatchObject([{ kind: "matched", vehicleId: "cybermapa-vehicle" }]);
    expect(fixture.vehicles.get("cybermapa-vehicle")?.placementFleetId).toBe("sentinel-cybermapa");
    expect([...fixture.contributions.values()]).toEqual([{ id: "id-1", connectionId: "howen-connection", externalId: "howen-device-1", vehicleId: "cybermapa-vehicle", capabilities: { gps: "eligible", video: "eligible", videoAlerts: "eligible" }, presence: "present" }]);
    expect([...fixture.memberships.values()]).toEqual([{ connectionId: "howen-connection", externalFleetId: "howen-fleet-1", vehicleId: "cybermapa-vehicle", label: "Howen North" }]);
  });

  it("does not persist a fleet membership when Howen does not expose complete fleet evidence", async () => {
    const fixture = createFixture();
    fixture.vehicles.set("cybermapa-vehicle", { id: "cybermapa-vehicle", normalizedPlate: "AB123CD", plate: "AB 123 CD", placementFleetId: "sentinel-cybermapa" });

    await seedHowenCatalog({ ...fixture, records: [record({ fleetid: undefined, fleetname: undefined })] });

    expect(fixture.contributions.size).toBe(1);
    expect(fixture.memberships.size).toBe(0);
    expect(fixture.vehicles.get("cybermapa-vehicle")?.placementFleetId).toBe("sentinel-cybermapa");
  });

  it("persists newly exposed fleet evidence when an existing Howen contribution is refreshed", async () => {
    const fixture = createFixture();
    fixture.vehicles.set("cybermapa-vehicle", { id: "cybermapa-vehicle", normalizedPlate: "AB123CD", plate: "AB 123 CD", placementFleetId: "sentinel-cybermapa" });

    await seedHowenCatalog({ ...fixture, records: [record({ fleetid: undefined, fleetname: undefined })] });
    await seedHowenCatalog({ ...fixture, records: [record()] });

    expect(fixture.contributions.size).toBe(1);
    expect([...fixture.memberships.values()]).toEqual([{ connectionId: "howen-connection", externalFleetId: "howen-fleet-1", vehicleId: "cybermapa-vehicle", label: "Howen North" }]);
    expect(fixture.vehicles.get("cybermapa-vehicle")?.placementFleetId).toBe("sentinel-cybermapa");
  });

  it("creates a Howen-only global vehicle only with validated plate evidence and its resolved initial placement", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record()] });

    expect(result.outcomes).toMatchObject([{ kind: "created" }]);
    expect([...fixture.vehicles.values()]).toEqual([{ id: "id-1", normalizedPlate: "AB123CD", plate: "AB123CD", placementFleetId: "sentinel-howen-north" }]);
    expect([...fixture.memberships.values()]).toEqual([{ connectionId: "howen-connection", externalFleetId: "howen-fleet-1", vehicleId: "id-1", label: "Howen North" }]);
  });

  it("keeps one global vehicle when shared Howen plate records repeat with different external identities", async () => {
    const fixture = createFixture();

    await seedHowenCatalog({ ...fixture, records: [record(), record({ deviceno: "howen-device-2" })] });

    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.contributions.size).toBe(2);
    expect(new Set([...fixture.contributions.values()].map((contribution) => contribution.vehicleId))).toEqual(new Set(["id-1"]));
  });

  it("retains invalid plate evidence for review instead of creating a Howen-only identity", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record({ devicename: "camera-truck-1" })] });

    expect(result.outcomes).toMatchObject([{ kind: "review", review: { reason: "missing-plate" } }]);
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.contributions.size).toBe(0);
  });

  it("does not create a Howen-only identity when fleet evidence has no resolvable initial Sentinel placement", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record({ fleetid: "howen-fleet-unknown", fleetname: "Howen South" })] });

    expect(result.outcomes).toMatchObject([{ kind: "review", review: { reason: "missing-placement" } }]);
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.contributions.size).toBe(0);
    expect(fixture.memberships.size).toBe(0);
  });
});
