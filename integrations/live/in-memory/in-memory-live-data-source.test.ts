import { describe, expect, it } from "vitest";

import { hasValidGps } from "@/domain/live";

import { inMemoryLiveDataSource } from "./in-memory-live-data-source";

describe("inMemoryLiveDataSource", () => {
  const { fleets, liveVehicles } = inMemoryLiveDataSource.readLiveState();

  it("exposes more than one fleet", () => {
    expect(fleets.length).toBeGreaterThan(1);
  });

  it("only references vehicles that exist", () => {
    const knownIds = new Set(
      liveVehicles.map((liveVehicle) => liveVehicle.vehicle.id),
    );
    const referencedIds = fleets.flatMap((fleet) => fleet.vehicleIds);

    expect(referencedIds.every((id) => knownIds.has(id))).toBe(true);
  });

  it("assigns every vehicle to the fleet that lists it", () => {
    const mismatched = fleets.flatMap((fleet) =>
      fleet.vehicleIds.filter((vehicleId) => {
        const liveVehicle = liveVehicles.find(
          (candidate) => candidate.vehicle.id === vehicleId,
        );

        return liveVehicle?.vehicle.fleetId !== fleet.fleetId;
      }),
    );

    expect(mismatched).toEqual([]);
  });

  it("includes at least one offline vehicle so degraded states are visible", () => {
    expect(
      liveVehicles.some(({ telemetry }) => telemetry?.online !== true),
    ).toBe(true);
  });

  it("includes at least one vehicle without valid GPS", () => {
    expect(liveVehicles.some(({ telemetry }) => !hasValidGps(telemetry))).toBe(
      true,
    );
  });

  it("gives every vehicle a plate so search by plate is exercisable", () => {
    expect(liveVehicles.every(({ vehicle }) => Boolean(vehicle.plate))).toBe(
      true,
    );
  });

  it("returns a fresh copy on every read", () => {
    const first = inMemoryLiveDataSource.readLiveState();
    const second = inMemoryLiveDataSource.readLiveState();

    expect(first).toEqual(second);
    expect(first.fleets).not.toBe(second.fleets);
  });
});
