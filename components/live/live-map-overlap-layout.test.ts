import { describe, expect, it } from "vitest";

import { buildDeterministicOverlapLayout } from "./live-map-overlap-layout";

describe("buildDeterministicOverlapLayout", () => {
  it("sorts vehicle ids so input order cannot move a vehicle", () => {
    const first = buildDeterministicOverlapLayout([
      "vehicle-c",
      "vehicle-a",
      "vehicle-b",
    ]);
    const second = buildDeterministicOverlapLayout([
      "vehicle-b",
      "vehicle-c",
      "vehicle-a",
    ]);

    expect(second).toEqual(first);
    expect(first.map((entry) => entry.vehicleId)).toEqual([
      "vehicle-a",
      "vehicle-b",
      "vehicle-c",
    ]);
  });

  it("gives every overlapping vehicle a distinct pixel position", () => {
    const layout = buildDeterministicOverlapLayout(
      Array.from({ length: 20 }, (_, index) => `vehicle-${index}`),
    );
    const positions = layout.map(
      ({ offsetX, offsetY }) => `${offsetX.toFixed(6)},${offsetY.toFixed(6)}`,
    );

    expect(layout).toHaveLength(20);
    expect(new Set(positions).size).toBe(20);
    expect(
      layout.every(({ offsetX, offsetY }) => Math.hypot(offsetX, offsetY) > 0),
    ).toBe(true);
  });

  it("uses additional rings when the first ring is full", () => {
    const layout = buildDeterministicOverlapLayout(
      Array.from({ length: 9 }, (_, index) => `vehicle-${index}`),
    );
    const radii = layout.map(({ offsetX, offsetY }) =>
      Math.round(Math.hypot(offsetX, offsetY)),
    );

    expect(new Set(radii)).toEqual(new Set([28, 56]));
  });
});
