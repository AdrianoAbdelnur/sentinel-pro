import { describe, expect, it } from "vitest";

import type { LiveVehicleState } from "./contracts";
import { buildLiveMapViewModel } from "./build-live-map-view-model";

const liveVehicles: LiveVehicleState[] = [
  {
    vehicle: {
      id: "vehicle-1",
      customerId: "customer-1",
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
      customerId: "customer-1",
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
        message: "Select at least one vehicle to view it on the map.",
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
        message: "The selected vehicles do not have valid GPS coordinates.",
      },
    });
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
});
