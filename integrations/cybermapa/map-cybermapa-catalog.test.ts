import { describe, expect, it } from "vitest";

import type { CatalogVehicle, ProviderContribution } from "@/domain/catalog";

import { mapCybermapaCatalog, seedCybermapaCatalog } from "./seed-cybermapa-catalog";
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
  it("omits malformed plate evidence so the matcher sends it to review", () => {
    const [candidate] = mapCybermapaCatalog([record({ patente: "CAMION-ROJO" })], { connectionId: "cyber-1", placementFleetId: "catalog-group" });

    expect(candidate?.plate).toBe("CAMION-ROJO");
    expect(candidate?.normalizedPlate).toBeUndefined();
  });

  it("maps a vehicle to GPS and operational alerts without requiring a provider fleet", () => {
    expect(mapCybermapaCatalog([record({ nombre_empresa: undefined })], { connectionId: "cyber-1", placementFleetId: "catalog-group" })).toEqual([
      {
        connectionId: "cyber-1",
        externalId: "90001",
        plate: "AB123CD",
        normalizedPlate: "AB123CD",
        placementFleetId: "catalog-group",
        capabilities: { gps: "eligible", operationalAlerts: "eligible" },
        presence: "present",
      },
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
});

describe("seedCybermapaCatalog", () => {
  it("sends malformed plate evidence to review", async () => {
    const vehicles = new Map<string, CatalogVehicle>();
    const contributions = new Map<string, ProviderContribution>();
    const catalogRepositories = {
      vehicles: { findByNormalizedPlate: async (plate: string) => [...vehicles.values()].find((vehicle) => vehicle.normalizedPlate === plate), save: async (vehicle: CatalogVehicle) => { vehicles.set(vehicle.id, vehicle); } },
      contributions: { findByConnectionAndExternalId: async (connectionId: string, externalId: string) => contributions.get(`${connectionId}:${externalId}`), save: async (contribution: ProviderContribution) => { contributions.set(`${contribution.connectionId}:${contribution.externalId}`, contribution); } },
      reviews: { findByConnectionAndExternalId: async () => undefined, save: async () => undefined },
    };
    const transactions = { run: async <T>(work: (repositories: typeof catalogRepositories) => Promise<T>) => work(catalogRepositories), isConflict: () => false };

    const result = await seedCybermapaCatalog({ records: [record({ patente: "CAMION-ROJO" })], connectionId: "cyber-1", placementFleetId: "catalog-group", ids: { create: () => "review-1" }, repositories: catalogRepositories, transactions });

    expect(result.outcomes).toMatchObject([{ kind: "review" }]);
    expect(vehicles.size).toBe(0);
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
