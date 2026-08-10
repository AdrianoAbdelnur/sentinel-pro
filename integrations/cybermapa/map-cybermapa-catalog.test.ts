import { describe, expect, it } from "vitest";

import { normalizePlate } from "@/domain/catalog";

import { mapCybermapaCatalog } from "./map-cybermapa-catalog";
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
        normalizedPlate: normalizePlate("AB123CD"),
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

  it("omits normalizedPlate when patente is absent", () => {
    const candidates = mapCybermapaCatalog([record({ patente: undefined })]);

    expect(candidates[0]?.normalizedPlate).toBeUndefined();
  });

  it("omits normalizedPlate when patente normalizes to an empty string", () => {
    const candidates = mapCybermapaCatalog([record({ patente: "   " })]);

    expect(candidates[0]?.normalizedPlate).toBeUndefined();
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
        normalizedPlate: normalizePlate("AB123CD"),
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
