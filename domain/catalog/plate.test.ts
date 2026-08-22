import { describe, expect, it } from "vitest";

import { isValidNormalizedPlate, normalizePlate } from "./plate";

describe("catalog plate identity", () => {
  it("accepts the supported normalized plate formats", () => {
    expect(isValidNormalizedPlate(normalizePlate("ABC-123"))).toBe(true);
    expect(isValidNormalizedPlate(normalizePlate("AB-123-CD"))).toBe(true);
  });

  it("rejects values that are not supported plate formats", () => {
    expect(isValidNormalizedPlate(normalizePlate("CAMION-ROJO"))).toBe(false);
    expect(isValidNormalizedPlate(normalizePlate("A?C12"))).toBe(false);
    expect(isValidNormalizedPlate(normalizePlate(""))).toBe(false);
  });
});
