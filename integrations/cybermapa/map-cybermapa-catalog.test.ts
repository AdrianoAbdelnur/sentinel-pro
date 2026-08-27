import { describe, expect, it } from "vitest";

import type { CatalogDevice, CatalogVehicle, ProviderContribution, ProviderVehicleObservation } from "@/domain/catalog";

import { decodeCybermapaLabel, mapCybermapaCatalog, seedCybermapaCatalog } from "./seed-cybermapa-catalog";
import type { CybermapaVehicleRecord } from "./responses";

function record(overrides: Partial<CybermapaVehicleRecord> = {}): CybermapaVehicleRecord {
  return {
    gps_id: 90001,
    nombre_empresa: "Transporte Andino",
    patente: "AB123CD",
    alias: "Camion 1",
    ...overrides,
  };
}

describe("mapCybermapaCatalog", () => {
  it("decodes URL-encoded company labels before they enter the catalog", () => {
    expect(decodeCybermapaLabel("RD%20-%20NUEVO%20%2F%20SUR")).toBe("RD - NUEVO / SUR");
  });

  it("omits malformed plate evidence so the matcher sends it to review", () => {
    const [candidate] = mapCybermapaCatalog([record({ patente: "CAMION-ROJO" })], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate?.plate).toBe("CAMION-ROJO");
    expect(candidate?.normalizedPlate).toBeUndefined();
  });

  it("maps a vehicle to GPS and operational alerts without requiring a provider fleet", () => {
    expect(mapCybermapaCatalog([record({ nombre_empresa: undefined })], { connectionId: "cyber-1", placementFleetId: "catalog-group" })).toMatchObject([
      expect.objectContaining({
        connectionId: "cyber-1",
        externalId: "90001",
        plate: "AB123CD",
        normalizedPlate: "AB123CD",
        placementFleetId: "catalog-group",
        capabilities: { gps: "eligible", operationalAlerts: "eligible" },
        presence: "present",
      }),
    ]);
  });

  it("does not infer a provider fleet from adapter records", () => {
    const [candidate] = mapCybermapaCatalog([record()], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate).not.toHaveProperty("externalFleetId");
    expect(candidate).not.toHaveProperty("providerFleet");
  });

  it("keeps GPS and operational alerts eligible when plate evidence is absent for review", () => {
    const [candidate] = mapCybermapaCatalog([record({ patente: undefined })], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate?.normalizedPlate).toBeUndefined();
    expect(candidate?.capabilities).toEqual({ gps: "eligible", operationalAlerts: "eligible" });
  });

  it("treats URL-encoded whitespace as an absent plate", () => {
    const [candidate] = mapCybermapaCatalog([record({ patente: "%20" })], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate).not.toHaveProperty("plate");
    expect(candidate).not.toHaveProperty("normalizedPlate");
    expect(candidate?.observation).toMatchObject({ plate: undefined, normalizedPlate: undefined });
  });
});

describe("seedCybermapaCatalog", () => {
  it("persists the GPS device and source observation for a shared catalog plate", async () => {
    const vehicles = new Map<string, CatalogVehicle>([["shared", { id: "shared", normalizedPlate: "AB123CD", plate: "AB123CD", placementFleetId: "existing" }]]);
    const contributions = new Map<string, ProviderContribution>();
    const devices = new Map<string, CatalogDevice>();
    const observations = new Map<string, ProviderVehicleObservation>();
    const repositories = {
      vehicles: { findById: async (id: string) => vehicles.get(id), findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate), save: async (vehicle: CatalogVehicle) => { vehicles.set(vehicle.id, vehicle); } },
      contributions: { findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`), save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); } },
      devices: { findByConnectionAndDeviceId: async (connectionId: string, deviceId: string) => devices.get(`${connectionId}:${deviceId}`), listByVehicleId: async (vehicleId: string) => [...devices.values()].filter((device) => device.vehicleId === vehicleId), save: async (device: CatalogDevice) => { devices.set(`${device.connectionId}:${device.deviceId}`, device); } },
      observations: { save: async (observation: ProviderVehicleObservation) => { observations.set(observation.contributionId, observation); }, listByVehicleId: async (vehicleId: string) => [...observations.values()].filter((observation) => [...contributions.values()].some((contribution) => contribution.id === observation.contributionId && contribution.vehicleId === vehicleId)) },
      reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
    };
    let sequence = 0;

    const result = await seedCybermapaCatalog({ records: [record()], connectionId: "cyber-1", placementFleetId: "catalog-group", ids: { create: () => `id-${++sequence}` }, repositories, transactions: { run: async (work) => work(repositories), isConflict: () => false } });

    expect(result.outcomes).toMatchObject([{ kind: "matched", vehicleId: "shared" }]);
    expect([...devices.values()]).toMatchObject([{ connectionId: "cyber-1", deviceId: "90001", vehicleId: "shared", kind: "gps" }]);
    expect([...observations.values()]).toMatchObject([{ providerKey: "cybermapa", deviceId: "90001", company: "Transporte Andino", plate: "AB123CD" }]);
  });

  it("creates a normal identity from a valid GPS identity even with malformed plate evidence", async () => {
    const vehicles = new Map<string, CatalogVehicle>();
    const contributions = new Map<string, ProviderContribution>();
    const catalogRepositories = {
      vehicles: { findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate), save: async (vehicle: CatalogVehicle) => { vehicles.set(vehicle.id, vehicle); } },
      contributions: { findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`), save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); } },
      reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
    };
    const transactions = { run: async <T>(work: (repositories: typeof catalogRepositories) => Promise<T>) => work(catalogRepositories), isConflict: () => false };

    const result = await seedCybermapaCatalog({ records: [record({ patente: "CAMION-ROJO" })], connectionId: "cyber-1", placementFleetId: "catalog-group", ids: { create: () => "review-1" }, repositories: catalogRepositories, transactions });

    expect(result.outcomes).toMatchObject([{ kind: "created" }]);
    expect(vehicles.size).toBe(1);
  });

  it("stores decoded group evidence labels", () => {
    const [candidate] = mapCybermapaCatalog([record({ nombre_empresa: "BAJA%20BUSINESS" })], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate?.groupEvidence?.label).toBe("BAJA BUSINESS");
  });

  it("is idempotent and keeps one catalog vehicle and contribution on repeated seeds", async () => {
    const vehicles = new Map<string, CatalogVehicle>();
    const contributions = new Map<string, ProviderContribution>();
    let sequence = 0;
    const catalogRepositories = {
      vehicles: { findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate), save: async (vehicle: CatalogVehicle) => { vehicles.set(vehicle.id, vehicle); } },
      contributions: { findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`), save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); } },
      reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
    };
    const transactions = { run: async <T>(work: (repositories: typeof catalogRepositories) => Promise<T>) => work(catalogRepositories), isConflict: () => false };
    const input = { records: [record()], connectionId: "cyber-1", placementFleetId: "catalog-group", ids: { create: () => `id-${++sequence}` }, repositories: catalogRepositories, transactions };

    await seedCybermapaCatalog(input);
    await seedCybermapaCatalog(input);

    expect(vehicles.size).toBe(1);
    expect(contributions.size).toBe(1);
    expect([...vehicles.values()][0]?.placementFleetId).toBe("catalog-group");
    expect([...contributions.values()][0]?.capabilities).toEqual({ gps: "eligible", operationalAlerts: "eligible" });
  });
});
