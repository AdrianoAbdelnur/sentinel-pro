import { describe, expect, it } from "vitest";

import { normalizePlate } from "@/domain/catalog";
import type { GlobalVehicle, ProviderContribution } from "@/domain/catalog-global";

import { mapCybermapaCatalog } from "./map-cybermapa-catalog";
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

describe("mapCybermapaCatalog", () => {
  it("translates a valid record into a provider-neutral candidate", () => {
    const candidates = mapCybermapaCatalog([record()]);

    expect(candidates).toEqual([
      {
        externalId: "90001",
        companyLabel: "Transporte Andino",
        registeredPlate: normalizePlate("AB123CD"),
        label: "Camion 1",
      },
    ]);
  });

  it("falls back to nombre for the label when alias is absent", () => {
    const candidates = mapCybermapaCatalog([record({ alias: undefined, nombre: "Camion Norte" })]);

    expect(candidates[0]?.label).toBe("Camion Norte");
  });

  it("prefers alias over nombre for the label when both are present", () => {
    const candidates = mapCybermapaCatalog([record({ alias: "Camion 1", nombre: "Camion Norte" })]);

    expect(candidates[0]?.label).toBe("Camion 1");
  });

  it("omits the label when neither alias nor nombre is usable, without failing the candidate", () => {
    const candidates = mapCybermapaCatalog([record({ alias: undefined, nombre: undefined })]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBeUndefined();
  });

  it("omits registeredPlate when patente is absent", () => {
    const candidates = mapCybermapaCatalog([record({ patente: undefined })]);

    expect(candidates[0]?.registeredPlate).toBeUndefined();
  });

  it("omits registeredPlate when patente normalizes to an empty string", () => {
    const candidates = mapCybermapaCatalog([record({ patente: "   " })]);

    expect(candidates[0]?.registeredPlate).toBeUndefined();
  });

  it("rejects a record whose gps_id is absent, without substituting the unrelated id field", () => {
    const candidates = mapCybermapaCatalog([record({ gps_id: undefined, id: 501 })]);

    expect(candidates).toEqual([]);
  });

  it("rejects a record whose gps_id normalizes to an empty string", () => {
    const candidates = mapCybermapaCatalog([record({ gps_id: "   " })]);

    expect(candidates).toEqual([]);
  });

  it("rejects a record whose company label is absent", () => {
    const candidates = mapCybermapaCatalog([record({ nombre_empresa: undefined })]);

    expect(candidates).toEqual([]);
  });

  it("rejects a record whose company label normalizes to an empty string", () => {
    const candidates = mapCybermapaCatalog([record({ nombre_empresa: "   " })]);

    expect(candidates).toEqual([]);
  });

  it("trims surrounding whitespace from a usable company label", () => {
    const candidates = mapCybermapaCatalog([record({ nombre_empresa: "  Transporte Andino  " })]);

    expect(candidates[0]?.companyLabel).toBe("Transporte Andino");
  });

  it("continues processing valid records after rejecting an invalid one", () => {
    const candidates = mapCybermapaCatalog([
      record({ gps_id: undefined }),
      record({ gps_id: 90002, nombre_empresa: "Transporte Sur" }),
    ]);

    expect(candidates).toEqual([
      {
        externalId: "90002",
        companyLabel: "Transporte Sur",
        registeredPlate: normalizePlate("AB123CD"),
        label: "Camion 1",
      },
    ]);
  });

  it("deduplicates repeated gps_id values into a single candidate, keeping the first occurrence", () => {
    const candidates = mapCybermapaCatalog([
      record({ gps_id: 90001, nombre_empresa: "Transporte Andino" }),
      record({ gps_id: 90001, nombre_empresa: "Transporte Sur", patente: "ZZ999ZZ" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.companyLabel).toBe("Transporte Andino");
  });

  it("treats numeric and string wire encodings of the same gps_id as one identity", () => {
    const candidates = mapCybermapaCatalog([
      record({ gps_id: "90001" }),
      record({ gps_id: 90001, nombre_empresa: "Transporte Sur" }),
    ]);

    expect(candidates).toHaveLength(1);
  });
});

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
