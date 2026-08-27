import { describe, expect, it } from "vitest";

import type { CatalogDevice, CatalogVehicle, ProviderContribution, ProviderFleetMembership, ProviderVehicleObservation } from "@/domain/catalog";

import { seedHowenCatalog } from "./seed-howen-catalog";
import type { HowenRosterRecord } from "./responses";

function record(overrides: Partial<HowenRosterRecord> = {}): HowenRosterRecord {
  return {
    deviceno: "howen-device-1",
    devicename: "AB123CD",
    plateno: "AB123CD",
    fleetid: "howen-fleet-1",
    fleetname: "Howen North",
    ...overrides,
  };
}

function createFixture() {
  const vehicles = new Map<string, CatalogVehicle>();
  const contributions = new Map<string, ProviderContribution>();
  const memberships = new Map<string, ProviderFleetMembership>();
  const devices = new Map<string, CatalogDevice>();
  const observations = new Map<string, ProviderVehicleObservation>();
  let sequence = 0;
  const repositories = {
    vehicles: {
      findById: async (id: string) => vehicles.get(id),
      findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate),
      save: async (vehicle: CatalogVehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    contributions: {
      findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`),
      save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); },
    },
    devices: {
      findByConnectionAndDeviceId: async (connectionId: string, deviceId: string) => devices.get(`${connectionId}:${deviceId}`),
      listByVehicleId: async (vehicleId: string) => [...devices.values()].filter((device) => device.vehicleId === vehicleId),
      save: async (device: CatalogDevice) => { devices.set(`${device.connectionId}:${device.deviceId}`, device); },
    },
    observations: {
      save: async (observation: ProviderVehicleObservation) => { observations.set(observation.contributionId, observation); },
      listByVehicleId: async (vehicleId: string) => [...observations.values()].filter((observation) => [...contributions.values()].some((contribution) => contribution.id === observation.contributionId && contribution.vehicleId === vehicleId)),
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
  return { ...dependencies, vehicles, contributions, devices, observations, memberships };
}

describe("seedHowenCatalog", () => {
  it("matches an existing catalog plate, adds video, preserves catalog placement, and persists verified Howen fleet membership", async () => {
    const fixture = createFixture();
    fixture.vehicles.set("cybermapa-vehicle", { id: "cybermapa-vehicle", normalizedPlate: "AB123CD", plate: "AB 123 CD", placementFleetId: "sentinel-cybermapa" });

    const result = await seedHowenCatalog({ ...fixture, records: [record()] });

    expect(result.outcomes).toMatchObject([{ kind: "matched", vehicleId: "cybermapa-vehicle" }]);
    expect(fixture.vehicles.get("cybermapa-vehicle")?.placementFleetId).toBe("sentinel-cybermapa");
    expect([...fixture.contributions.values()]).toMatchObject([{ id: "id-1", connectionId: "howen-connection", externalId: "howen-device-1", vehicleId: "cybermapa-vehicle", deviceId: "howen-device-1", capabilities: { gps: "eligible", video: "eligible", videoAlerts: "eligible" }, presence: "present" }]);
    expect([...fixture.memberships.values()]).toEqual([{ connectionId: "howen-connection", externalFleetId: "howen-fleet-1", vehicleId: "cybermapa-vehicle", label: "Howen North" }]);
    expect([...fixture.devices.values()]).toMatchObject([{ connectionId: "howen-connection", deviceId: "howen-device-1", vehicleId: "cybermapa-vehicle" }]);
    expect([...fixture.observations.values()]).toMatchObject([{ providerKey: "howen", contributionId: "id-1", deviceId: "howen-device-1", plate: "AB123CD" }]);
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

  it("creates a Howen-only catalog vehicle only with validated plate evidence and its resolved initial placement", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record()] });

    expect(result.outcomes).toMatchObject([{ kind: "created" }]);
    expect([...fixture.vehicles.values()]).toMatchObject([{ id: "id-1", normalizedPlate: "AB123CD", plate: "AB123CD", placementFleetId: "sentinel-howen-north" }]);
    expect([...fixture.memberships.values()]).toEqual([{ connectionId: "howen-connection", externalFleetId: "howen-fleet-1", vehicleId: "id-1", label: "Howen North" }]);
  });

  it("keeps one catalog vehicle when shared Howen plate records repeat with different external identities", async () => {
    const fixture = createFixture();

    await seedHowenCatalog({ ...fixture, records: [record(), record({ deviceno: "howen-device-2" })] });

    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.contributions.size).toBe(2);
    expect(new Set([...fixture.contributions.values()].map((contribution) => contribution.vehicleId))).toEqual(new Set(["id-1"]));
  });

  it("creates a normal Howen identity when the optional plate is absent", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record({ plateno: undefined, devicename: "camera-truck-1" })] });

    expect(result.outcomes).toMatchObject([{ kind: "created" }]);
    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.contributions.size).toBe(1);
    expect(fixture.devices).toHaveLength(1);
    expect(fixture.observations).toHaveLength(1);
  });

  it("persists inherited Fleet company provenance in the current observation", async () => {
    const fixture = createFixture();

    await seedHowenCatalog({ ...fixture, resolveFleetCompany: () => ({ company: "Inherited Company", companySourceFleetId: "parent-fleet", outcome: "ancestor" as const }), records: [record({ fleetid: "child-fleet", fleetname: "Child Fleet" })] });

    expect([...fixture.observations.values()]).toMatchObject([{ company: "Inherited Company", directFleetId: "child-fleet", companySourceFleetId: "parent-fleet", companyResolution: "ancestor" }]);
  });

  it("creates a Howen identity without initial placement when fleet evidence has no resolvable placement", async () => {
    const fixture = createFixture();

    const result = await seedHowenCatalog({ ...fixture, records: [record({ fleetid: "howen-fleet-unknown", fleetname: "Howen South" })] });

    expect(result.outcomes).toMatchObject([{ kind: "created" }]);
    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.contributions.size).toBe(1);
    expect(fixture.memberships.size).toBe(1);
  });
});
