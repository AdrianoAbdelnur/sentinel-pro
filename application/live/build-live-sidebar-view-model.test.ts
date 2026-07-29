import { describe, expect, it } from "vitest";

import type { LiveFleetState, LiveVehicleState } from "./contracts";
import { buildLiveSidebarViewModel } from "./build-live-sidebar-view-model";

const fleets: LiveFleetState[] = [
  {
    fleetId: "fleet-north",
    label: "North Fleet",
    vehicleIds: ["vehicle-1", "vehicle-2"],
  },
  {
    fleetId: "fleet-south",
    label: "South Fleet",
    vehicleIds: ["vehicle-3"],
  },
];

const liveVehicles: LiveVehicleState[] = [
  {
    vehicle: {
      id: "vehicle-1",
      customerId: "customer-1",
      fleetId: "fleet-north",
      label: "Unit 101",
      plate: "ABC123",
      isActive: true,
    },
    device: {
      id: "device-1",
      vehicleId: "vehicle-1",
      provider: "howen",
      origin: "howen",
      kind: "mdvr",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-1",
      online: true,
      latitude: -34.6037,
      longitude: -58.3816,
    },
  },
  {
    vehicle: {
      id: "vehicle-2",
      customerId: "customer-1",
      fleetId: "fleet-north",
      label: "Unit 102",
      plate: "XYZ789",
      isActive: true,
    },
    device: {
      id: "device-2",
      vehicleId: "vehicle-2",
      provider: "howen",
      origin: "howen",
      kind: "mdvr",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-2",
      online: false,
    },
  },
  {
    vehicle: {
      id: "vehicle-3",
      customerId: "customer-1",
      fleetId: "fleet-south",
      label: "Unit 201",
      isActive: false,
    },
  },
];

function build(overrides: Partial<Parameters<typeof buildLiveSidebarViewModel>[0]> = {}) {
  return buildLiveSidebarViewModel({
    fleets,
    liveVehicles,
    selectedVehicleIds: [],
    searchTerm: "",
    ...overrides,
  });
}

describe("buildLiveSidebarViewModel", () => {
  it("collapses every fleet when there is no expansion override", () => {
    const result = build();

    expect(result.fleets.map((fleet) => fleet.isExpanded)).toEqual([false, false]);
  });

  it("expands only the fleets listed as expanded", () => {
    const result = build({ expandedFleetIds: ["fleet-south"] });

    expect(
      result.fleets.map((fleet) => [fleet.fleetId, fleet.isExpanded]),
    ).toEqual([
      ["fleet-north", false],
      ["fleet-south", true],
    ]);
  });

  it("marks a fleet as selected only when all of its vehicles are selected", () => {
    const result = build({ selectedVehicleIds: ["vehicle-1", "vehicle-3"] });

    expect(
      result.fleets.map((fleet) => [fleet.fleetId, fleet.isSelected]),
    ).toEqual([
      ["fleet-north", false],
      ["fleet-south", true],
    ]);
  });

  it("does not mark an empty fleet as selected", () => {
    const result = build({
      fleets: [{ fleetId: "fleet-empty", label: "Empty Fleet", vehicleIds: [] }],
      selectedVehicleIds: ["vehicle-1"],
    });

    expect(result.fleets[0].isSelected).toBe(false);
  });

  it("derives vehicle node operational flags from device and telemetry", () => {
    const result = build({ selectedVehicleIds: ["vehicle-1"], expandedFleetIds: ["fleet-north"] });

    expect(result.fleets[0].vehicles).toEqual([
      {
        vehicleId: "vehicle-1",
        label: "Unit 101",
        secondaryLabel: "ABC123",
        isSelected: true,
        isOnline: true,
        hasValidGps: true,
        canOpenLive: true,
      },
      {
        vehicleId: "vehicle-2",
        label: "Unit 102",
        secondaryLabel: "XYZ789",
        isSelected: false,
        isOnline: false,
        hasValidGps: false,
        canOpenLive: false,
      },
    ]);
  });

  it("expands matching fleets and keeps only matching vehicles when searching by vehicle label", () => {
    const result = build({ searchTerm: "unit 102" });

    expect(result.fleets).toHaveLength(1);
    expect(result.fleets[0].fleetId).toBe("fleet-north");
    expect(result.fleets[0].isExpanded).toBe(true);
    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-2",
    ]);
  });

  it("matches vehicles by plate", () => {
    const result = build({ searchTerm: "abc12" });

    expect(result.fleets).toHaveLength(1);
    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
    ]);
  });

  it("keeps every vehicle visible when the fleet label itself matches", () => {
    const result = build({ searchTerm: "north" });

    expect(result.fleets).toHaveLength(1);
    expect(result.fleets[0].isExpanded).toBe(true);
    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
      "vehicle-2",
    ]);
  });

  it("keeps the fleet checkbox tied to all vehicles while search narrows the visible ones", () => {
    const result = build({
      searchTerm: "unit 101",
      selectedVehicleIds: ["vehicle-1", "vehicle-2"],
    });

    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
    ]);
    // Both vehicles of the fleet are selected, so the fleet stays selected even
    // though the search hides one of them.
    expect(result.fleets[0].isSelected).toBe(true);
  });

  it("does not select the fleet when a hidden vehicle is unselected", () => {
    const result = build({
      searchTerm: "unit 101",
      selectedVehicleIds: ["vehicle-1"],
    });

    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
    ]);
    expect(result.fleets[0].isSelected).toBe(false);
  });

  it("returns no fleets when nothing matches the search term", () => {
    expect(build({ searchTerm: "nothing-matches" }).fleets).toEqual([]);
  });

  it("ignores surrounding whitespace and casing in the search term", () => {
    expect(build({ searchTerm: "   " }).fleets).toHaveLength(2);
    expect(build({ searchTerm: "  NORTH  " }).fleets).toHaveLength(1);
  });

  it("drops vehicles that are neither active nor online when the filter is on", () => {
    const result = build({
      onlyActiveOrOnline: true,
      expandedFleetIds: ["fleet-north", "fleet-south"],
    });

    expect(result.filters.onlyActiveOrOnline).toBe(true);
    expect(result.fleets.map((fleet) => fleet.fleetId)).toEqual(["fleet-north"]);
    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
      "vehicle-2",
    ]);
  });

  it("echoes the search term and exposes a placeholder", () => {
    const result = build({ searchTerm: "  north  " });

    expect(result.search.term).toBe("  north  ");
    expect(result.search.placeholder).toBe("Search by vehicle, plate or fleet");
  });
});
