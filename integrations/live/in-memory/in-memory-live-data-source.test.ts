import { describe, expect, it } from "vitest";

import { DEFAULT_STALE_AFTER_MS, hasValidGps, resolveVehicleStatus } from "@/domain/live";

import { inMemoryLiveDataSource } from "./in-memory-live-data-source";

describe("inMemoryLiveDataSource", () => {
  const { fleets, liveVehicles } = inMemoryLiveDataSource.readLiveState();
  const nowMs = Date.now();

  function statusOf(vehicleId: string) {
    const liveVehicle = liveVehicles.find(
      (candidate) => candidate.vehicle.id === vehicleId,
    );

    return resolveVehicleStatus({
      telemetry: liveVehicle?.telemetry,
      nowMs,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
    });
  }

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

  it("gives every vehicle a plate so search by plate is exercisable", () => {
    expect(liveVehicles.every(({ vehicle }) => Boolean(vehicle.plate))).toBe(
      true,
    );
  });

  it("returns a fresh copy on every read", () => {
    const first = inMemoryLiveDataSource.readLiveState();
    const second = inMemoryLiveDataSource.readLiveState();

    expect(first.fleets).toEqual(second.fleets);
    expect(first.fleets).not.toBe(second.fleets);
    expect(first.liveVehicles.map(({ vehicle }) => vehicle.id)).toEqual(
      second.liveVehicles.map(({ vehicle }) => vehicle.id),
    );
    expect(first.liveVehicles).not.toBe(second.liveVehicles);
  });

  it("exposes bottom panel tabs and columns by key only, never a label", () => {
    const tabs = inMemoryLiveDataSource.readBottomPanelTabs();

    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(tab).not.toHaveProperty("label");
      expect(tab.columns.length).toBeGreaterThan(0);
      for (const column of tab.columns) {
        expect(column).not.toHaveProperty("label");
      }
    }
  });

  it("keeps bottom panel tab rows pointed at vehicles that still exist", () => {
    const knownIds = new Set(
      liveVehicles.map((liveVehicle) => liveVehicle.vehicle.id),
    );
    const tabs = inMemoryLiveDataSource.readBottomPanelTabs();

    for (const tab of tabs) {
      for (const row of tab.rows) {
        expect(knownIds.has(row.vehicleId)).toBe(true);
      }
    }
  });

  it("has at least one partial bottom panel row and one vehicle with no row at all", () => {
    const tabs = inMemoryLiveDataSource.readBottomPanelTabs();
    const rowsByVehicleId = new Map<string, number>();

    for (const tab of tabs) {
      for (const row of tab.rows) {
        const columnCount = tab.columns.length;
        const cellCount = Object.keys(row.cells).length;

        if (cellCount < columnCount) {
          rowsByVehicleId.set("__has-partial-row__", 1);
        }

        rowsByVehicleId.set(
          row.vehicleId,
          (rowsByVehicleId.get(row.vehicleId) ?? 0) + 1,
        );
      }
    }

    expect(rowsByVehicleId.has("__has-partial-row__")).toBe(true);
    expect(
      liveVehicles.some(
        ({ vehicle }) => !rowsByVehicleId.has(vehicle.id),
      ),
    ).toBe(true);
  });

  describe("status resolution matrix (domain/live/vehicle-status.ts)", () => {
    it("resolves an online, moving vehicle as en-route", () => {
      expect(statusOf("vehicle-101")).toBe("en-route");
    });

    it("resolves a vehicle explicitly flagged offline as offline, even with a fresh report and non-zero speed", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-102",
      );

      expect(liveVehicle?.telemetry?.online).toBe(false);
      expect(liveVehicle?.telemetry?.speedKmH).toBeGreaterThan(0);
      expect(statusOf("vehicle-102")).toBe("offline");
    });

    it("resolves a vehicle with no online flag and a recent report as stopped (fallback + zero speed)", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-201",
      );

      expect(liveVehicle?.telemetry?.online).toBeUndefined();
      expect(liveVehicle?.telemetry?.speedKmH).toBe(0);
      expect(statusOf("vehicle-201")).toBe("stopped");
    });

    it("resolves a vehicle with no online flag and a stale report as offline (fallback), suppressing a non-zero stored speed", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-202",
      );

      expect(liveVehicle?.telemetry?.online).toBeUndefined();
      expect(liveVehicle?.telemetry?.speedKmH).toBeGreaterThan(0);
      expect(statusOf("vehicle-202")).toBe("offline");
    });

    it("resolves an online vehicle with no reported speed as stopped", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-301",
      );

      expect(liveVehicle?.telemetry?.online).toBe(true);
      expect(liveVehicle?.telemetry?.speedKmH).toBeUndefined();
      expect(statusOf("vehicle-301")).toBe("stopped");
    });

    it("resolves a vehicle with no telemetry at all and an inactive device as offline", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-302",
      );

      expect(liveVehicle?.telemetry).toBeUndefined();
      expect(liveVehicle?.device?.isActive).toBe(false);
      expect(statusOf("vehicle-302")).toBe("offline");
    });

    it("resolves a vehicle with neither telemetry nor a device as offline", () => {
      const liveVehicle = liveVehicles.find(
        (candidate) => candidate.vehicle.id === "vehicle-303",
      );

      expect(liveVehicle?.telemetry).toBeUndefined();
      expect(liveVehicle?.device).toBeUndefined();
      expect(statusOf("vehicle-303")).toBe("offline");
    });

    it("exercises all three statuses across the fixture", () => {
      const statuses = new Set(
        liveVehicles.map(({ telemetry }) =>
          resolveVehicleStatus({ telemetry, nowMs, staleAfterMs: DEFAULT_STALE_AFTER_MS }),
        ),
      );

      expect(statuses).toEqual(new Set(["en-route", "stopped", "offline"]));
    });
  });

  it("includes at least one vehicle without valid GPS", () => {
    expect(liveVehicles.some(({ telemetry }) => !hasValidGps(telemetry))).toBe(
      true,
    );
  });

  it("includes at least one vehicle with valid GPS", () => {
    expect(liveVehicles.some(({ telemetry }) => hasValidGps(telemetry))).toBe(
      true,
    );
  });

  it("includes a flattened sub-fleet rendered as a sibling, never nested", () => {
    const baseFleet = fleets.find((fleet) => fleet.label === "AB Construcciones");
    const subFleet = fleets.find(
      (fleet) => fleet.label === "AB Construcciones (Rio Tinto)",
    );

    expect(baseFleet).toBeDefined();
    expect(subFleet).toBeDefined();
    expect(baseFleet?.fleetId).not.toBe(subFleet?.fleetId);
  });

  it("includes one empty fleet, to exercise counts.total = 0", () => {
    const emptyFleets = fleets.filter((fleet) => fleet.vehicleIds.length === 0);

    expect(emptyFleets.length).toBeGreaterThan(0);
  });

  it("exposes at least three distinct provider values, plus a vehicle with no provider at all", () => {
    const providers = new Set(
      liveVehicles
        .map(({ device }) => device?.provider)
        .filter((value): value is string => Boolean(value)),
    );

    expect(providers.size).toBeGreaterThanOrEqual(3);
    expect(liveVehicles.some(({ device }) => device === undefined)).toBe(true);
  });

  it("materializes gpsAt relative to read time, not a fixed timestamp", () => {
    const readAt = Date.now();
    const { liveVehicles: freshVehicles } = inMemoryLiveDataSource.readLiveState();
    const vehicle = freshVehicles.find(
      (candidate) => candidate.vehicle.id === "vehicle-101",
    );

    expect(vehicle?.telemetry?.gpsAt).toBeDefined();

    const elapsedMs = readAt - Date.parse(vehicle!.telemetry!.gpsAt!);

    expect(elapsedMs).toBeGreaterThanOrEqual(25_000);
    expect(elapsedMs).toBeLessThanOrEqual(35_000);
  });
});
