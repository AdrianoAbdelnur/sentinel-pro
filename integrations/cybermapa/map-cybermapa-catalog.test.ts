import { describe, expect, it } from "vitest";

import type { GlobalVehicle, ProviderContribution } from "@/domain/catalog";

import { mapCybermapaGlobalCatalog, seedCybermapaCatalog } from "./seed-cybermapa-catalog";
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

describe("mapCybermapaGlobalCatalog", () => {
  it("maps a vehicle to GPS and operational alerts without requiring a provider fleet", () => {
    expect(mapCybermapaGlobalCatalog([record({ nombre_empresa: undefined })], { connectionId: "cyber-1", placementFleetId: "sentinel-fleet" })).toEqual([
      {
        connectionId: "cyber-1",
        externalId: "90001",
        plate: "AB123CD",
        normalizedPlate: "AB123CD",
        placementFleetId: "sentinel-fleet",
        capabilities: { gps: "eligible", operationalAlerts: "eligible" },
        presence: "present",
      },
    ]);
  });

  it("does not infer a provider fleet from adapter records", () => {
    const [candidate] = mapCybermapaGlobalCatalog([record()], { connectionId: "cyber-1", placementFleetId: "sentinel-fleet" });

    expect(candidate).not.toHaveProperty("externalFleetId");
    expect(candidate).not.toHaveProperty("providerFleet");
  });

  it("keeps GPS and operational alerts eligible when plate evidence is absent for review", () => {
    const [candidate] = mapCybermapaGlobalCatalog([record({ patente: undefined })], { connectionId: "cyber-1", placementFleetId: "sentinel-fleet" });

    expect(candidate?.normalizedPlate).toBeUndefined();
    expect(candidate?.capabilities).toEqual({ gps: "eligible", operationalAlerts: "eligible" });
  });
});

describe("seedCybermapaCatalog", () => {
  it("is idempotent and keeps one global vehicle and contribution on repeated seeds", async () => {
    const vehicles = new Map<string, GlobalVehicle>();
    const contributions = new Map<string, ProviderContribution>();
    let sequence = 0;
    const globalRepositories = {
      vehicles: { findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate), save: async (vehicle: GlobalVehicle) => { vehicles.set(vehicle.id, vehicle); } },
      contributions: { findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`), save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); } },
      reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
    };
    const transactions = { run: async <T>(work: (repositories: typeof globalRepositories) => Promise<T>) => work(globalRepositories), isConflict: () => false };
    const input = { records: [record()], connectionId: "cyber-1", placementFleetId: "sentinel-fleet", ids: { create: () => `id-${++sequence}` }, repositories: globalRepositories, transactions };

    await seedCybermapaCatalog(input);
    await seedCybermapaCatalog(input);

    expect(vehicles.size).toBe(1);
    expect(contributions.size).toBe(1);
    expect([...vehicles.values()][0]?.placementFleetId).toBe("sentinel-fleet");
    expect([...contributions.values()][0]?.capabilities).toEqual({ gps: "eligible", operationalAlerts: "eligible" });
  });
});
