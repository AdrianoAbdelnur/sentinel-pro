import { describe, expect, it } from "vitest";

import type { LiveVehicleState } from "./contracts";
import { buildLiveMapViewModel } from "./build-live-map-view-model";

const liveVehicles: LiveVehicleState[] = [
  {
    vehicle: {
      id: "vehicle-1",
      fleetId: "fleet-1",
      label: "Unit 101",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-1",
      online: true,
      latitude: -34.6037,
      longitude: -58.3816,
      speedKmH: 45,
      headingDeg: 90,
    },
  },
  {
    vehicle: {
      id: "vehicle-2",
      fleetId: "fleet-1",
      label: "Unit 102",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-2",
      online: false,
      latitude: undefined,
      longitude: -58.4,
    },
  },
  {
    vehicle: {
      id: "vehicle-offline",
      fleetId: "fleet-1",
      label: "Offline unit",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-offline",
      online: false,
      latitude: -34.61,
      longitude: -58.39,
      speedKmH: 0,
    },
  },
];

describe("buildLiveMapViewModel", () => {
  it("returns no-selection when no vehicles are selected", () => {
    expect(
      buildLiveMapViewModel({
        selectedVehicleIds: [],
        liveVehicles,
      }),
    ).toEqual({
      markers: [],
      emptyState: {
        code: "no-selection",
      },
    });
  });

  it("returns no-mappable-selection when the selection has no valid GPS", () => {
    expect(
      buildLiveMapViewModel({
        selectedVehicleIds: ["vehicle-2"],
        liveVehicles,
      }),
    ).toEqual({
      markers: [],
      emptyState: {
        code: "no-mappable-selection",
      },
    });
  });

  it("returns one marker per selected vehicle when several have valid GPS", () => {
    const thirdVehicle: LiveVehicleState = {
      vehicle: {
        id: "vehicle-3",
        fleetId: "fleet-1",
        label: "Unit 103",
        isActive: true,
      },
      telemetry: {
        deviceId: "device-3",
        online: true,
        latitude: -34.9011,
        longitude: -56.1645,
      },
    };

    const result = buildLiveMapViewModel({
      selectedVehicleIds: ["vehicle-1", "vehicle-2", "vehicle-3"],
      liveVehicles: [...liveVehicles, thirdVehicle],
    });

    expect(result.markers.map((marker) => marker.vehicleId)).toEqual([
      "vehicle-1",
      "vehicle-3",
    ]);
    expect(result.emptyState).toBeUndefined();
  });

  it("returns one marker per selected vehicle with valid GPS", () => {
    expect(
      buildLiveMapViewModel({
        selectedVehicleIds: ["vehicle-1", "vehicle-2"],
        liveVehicles,
      }),
    ).toEqual({
      markers: [
        {
          vehicleId: "vehicle-1",
          label: "Unit 101",
          latitude: -34.6037,
          longitude: -58.3816,
          speedKmH: 45,
          headingDeg: 90,
        },
      ],
    });
  });

  it("uses the plate as the marker label when the secondary label is absent", () => {
    const vehicleWithoutSecondaryLabel: LiveVehicleState = {
      ...liveVehicles[0],
      vehicle: {
        ...liveVehicles[0].vehicle,
        label: undefined,
        plate: "ABC123",
      },
    };

    expect(
      buildLiveMapViewModel({
        selectedVehicleIds: ["vehicle-1"],
        liveVehicles: [vehicleWithoutSecondaryLabel],
      }),
    ).toEqual({
      markers: [
        {
          vehicleId: "vehicle-1",
          label: "ABC123",
          latitude: -34.6037,
          longitude: -58.3816,
          speedKmH: 45,
          headingDeg: 90,
        },
      ],
    });
  });

  it("does not expose speed for an offline marker", () => {
    expect(
      buildLiveMapViewModel({
        selectedVehicleIds: ["vehicle-offline"],
        liveVehicles,
        nowMs: Date.parse("2026-08-24T12:00:00.000Z"),
        staleAfterMs: 5 * 60 * 1000,
      }),
    ).toEqual({
      markers: [
        {
          vehicleId: "vehicle-offline",
          label: "Offline unit",
          latitude: -34.61,
          longitude: -58.39,
          headingDeg: undefined,
          status: "offline",
          speedKmH: undefined,
        },
      ],
    });
  });
});
