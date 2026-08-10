import { describe, expect, it, vi } from "vitest";

import { normalizePlate } from "@/domain/catalog";

import { CybermapaRequestError, type CybermapaClient } from "./client";
import { createCybermapaImportSource } from "./source";

function client(fetchVehicles: CybermapaClient["fetchVehicles"]): CybermapaClient {
  return { fetchVehicles };
}

describe("createCybermapaImportSource", () => {
  it("returns a complete snapshot with the mapped candidates when the fetch succeeds", async () => {
    const fetchVehicles = vi.fn().mockResolvedValueOnce([
      { gps_id: 90001, nombre_empresa: "Transporte Andino", patente: "AB123CD" },
      { nombre_empresa: "Transporte Sur" },
    ]);
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    const result = await source.loadCompleteSnapshot();

    expect(result).toEqual({
      kind: "complete",
      candidates: [
        {
          externalId: "90001",
          companyLabel: "Transporte Andino",
          normalizedPlate: normalizePlate("AB123CD"),
        },
      ],
    });
  });

  it("returns a complete but empty snapshot when the provider genuinely reports zero vehicles", async () => {
    const fetchVehicles = vi.fn().mockResolvedValueOnce([]);
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    await expect(source.loadCompleteSnapshot()).resolves.toEqual({ kind: "complete", candidates: [] });
  });

  it("returns a complete snapshot with every candidate when a non-empty response is fully usable", async () => {
    const fetchVehicles = vi.fn().mockResolvedValueOnce([
      { gps_id: 90001, nombre_empresa: "Transporte Andino" },
      { gps_id: 90002, nombre_empresa: "Transporte Sur" },
    ]);
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    const result = await source.loadCompleteSnapshot();

    expect(result.kind).toBe("complete");
    expect(result.kind === "complete" ? result.candidates : []).toHaveLength(2);
  });

  it("returns a failed invalid-response snapshot when every record in a non-empty response is unparseable, instead of impersonating an empty catalog", async () => {
    const fetchVehicles = vi.fn().mockResolvedValueOnce([{}, {}, {}]);
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    const result = await source.loadCompleteSnapshot();

    expect(result).toEqual({ kind: "failed", failure: { category: "invalid-response" } });
    expect(result).not.toHaveProperty("candidates");
  });

  it("returns a failed snapshot carrying only the allow-listed category when the client rejects with a CybermapaRequestError, never a complete result", async () => {
    const fetchVehicles = vi.fn().mockRejectedValueOnce(new CybermapaRequestError("invalid-response", 500));
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    const result = await source.loadCompleteSnapshot();

    expect(result).toEqual({ kind: "failed", failure: { category: "invalid-response", httpStatus: 500 } });
    expect(result).not.toHaveProperty("candidates");
  });

  it("returns a failed internal-category snapshot when an unexpected error escapes the client, instead of silently returning a complete empty snapshot", async () => {
    const fetchVehicles = vi.fn().mockRejectedValueOnce(new Error("unexpected mapper crash"));
    const source = createCybermapaImportSource({ client: client(fetchVehicles) });

    const result = await source.loadCompleteSnapshot();

    expect(result).toEqual({ kind: "failed", failure: { category: "internal" } });
    expect(JSON.stringify(result)).not.toContain("unexpected mapper crash");
  });
});
