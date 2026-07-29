import { describe, expect, it } from "vitest";

import type { LiveFleetState, LiveVehicleState } from "./contracts";
import { buildLiveSidebarViewModel } from "./build-live-sidebar-view-model";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const STALE_AFTER_MS = 5 * 60 * 1000;

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
      gpsAt: "2026-07-29T11:59:30.000Z",
      latitude: -34.6037,
      longitude: -58.3816,
      speedKmH: 42,
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
      provider: "praxsys",
      origin: "other",
      kind: "mdvr",
      isActive: true,
    },
    telemetry: {
      deviceId: "device-2",
      online: false,
      speedKmH: 55,
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
    nowMs: NOW,
    staleAfterMs: STALE_AFTER_MS,
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

    expect(result.fleets[0]).toMatchObject({
      isSelected: false,
      counts: { online: 0, total: 0 },
      vehicles: [],
    });
  });

  it("CONTRACT SHAPE: composes the full sidebar view model (search, filters, fleets, vehicle nodes)", () => {
    const result = build({
      selectedVehicleIds: ["vehicle-1"],
      expandedFleetIds: ["fleet-north", "fleet-south"],
    });

    expect(result).toEqual({
      search: { term: "" },
      filters: {
        status: "all",
        provider: undefined,
        availableProviders: ["howen", "praxsys"],
        isNarrowed: false,
      },
      fleets: [
        {
          fleetId: "fleet-north",
          label: "North Fleet",
          isExpanded: true,
          isSelected: false,
          counts: { online: 1, total: 2 },
          vehicles: [
            {
              vehicleId: "vehicle-1",
              plate: "ABC123",
              label: "Unit 101",
              status: "en-route",
              speedKmH: 42,
              lastReportAt: "2026-07-29T11:59:30.000Z",
              provider: "howen",
              isSelected: true,
              hasValidGps: true,
              canOpenLive: true,
            },
            {
              vehicleId: "vehicle-2",
              plate: "XYZ789",
              label: "Unit 102",
              status: "offline",
              speedKmH: undefined,
              lastReportAt: undefined,
              provider: "praxsys",
              isSelected: false,
              hasValidGps: false,
              canOpenLive: false,
            },
          ],
        },
        {
          fleetId: "fleet-south",
          label: "South Fleet",
          isExpanded: true,
          isSelected: false,
          counts: { online: 0, total: 1 },
          vehicles: [
            {
              vehicleId: "vehicle-3",
              plate: undefined,
              label: "Unit 201",
              status: "offline",
              speedKmH: undefined,
              lastReportAt: undefined,
              provider: undefined,
              isSelected: false,
              hasValidGps: false,
              canOpenLive: false,
            },
          ],
        },
      ],
    });
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

  it("does not match a vehicle by its internal code", () => {
    const result = build({
      liveVehicles: [
        {
          ...liveVehicles[0],
          vehicle: {
            ...liveVehicles[0].vehicle,
            internalCode: "SECRET-UNIT-CODE",
          },
        },
      ],
      searchTerm: "secret-unit-code",
    });

    expect(result.fleets).toEqual([]);
  });

  it.each([
    {
      field: "provider",
      searchTerm: "secret-provider",
      liveVehicle: {
        ...liveVehicles[0],
        device: {
          ...liveVehicles[0].device!,
          provider: "SECRET-PROVIDER",
        },
      },
    },
    {
      field: "device identifier",
      searchTerm: "secret-device-id",
      liveVehicle: {
        ...liveVehicles[0],
        device: {
          ...liveVehicles[0].device!,
          id: "SECRET-DEVICE-ID",
        },
      },
    },
    {
      field: "unrelated customer identifier",
      searchTerm: "secret-customer-id",
      liveVehicle: {
        ...liveVehicles[0],
        vehicle: {
          ...liveVehicles[0].vehicle,
          customerId: "SECRET-CUSTOMER-ID",
        },
      },
    },
  ])("does not match a vehicle by its $field", ({ liveVehicle, searchTerm }) => {
    const result = build({
      liveVehicles: [liveVehicle],
      searchTerm,
    });

    expect(result.fleets).toEqual([]);
  });

  it("keeps the fleet checkbox tied to all vehicles while search narrows the visible ones", () => {
    const result = build({
      searchTerm: "unit 101",
      selectedVehicleIds: ["vehicle-1", "vehicle-2"],
    });

    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
    ]);
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

  it("echoes the search term without carrying display text", () => {
    const result = build({ searchTerm: "  north  " });

    expect(result.search).toEqual({ term: "  north  " });
  });

  it("REGRESSION (D7 fix): fleet selection state reflects the full roster, ignoring status narrowing", () => {
    const result = build({
      status: "en-route",
      selectedVehicleIds: ["vehicle-1"],
      expandedFleetIds: ["fleet-north"],
    });

    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-1",
    ]);
    expect(result.fleets[0].isSelected).toBe(false);
  });

  it("narrows visible vehicles by the status filter", () => {
    const result = build({
      status: "offline",
      expandedFleetIds: ["fleet-north", "fleet-south"],
    });

    expect(
      result.fleets.map((fleet) => fleet.vehicles.map((vehicle) => vehicle.vehicleId)),
    ).toEqual([["vehicle-2"], ["vehicle-3"]]);
  });

  it("drops fleets left empty by the status filter", () => {
    expect(build({ status: "stopped" }).fleets).toEqual([]);
  });

  it("narrows visible vehicles by the provider filter and excludes vehicles without a device", () => {
    const result = build({ provider: "praxsys" });

    expect(result.fleets.map((fleet) => fleet.fleetId)).toEqual(["fleet-north"]);
    expect(result.fleets[0].vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([
      "vehicle-2",
    ]);
  });

  it("shows every vehicle when the status filter is all and no provider filter is set", () => {
    const result = build();

    expect(result.filters).toEqual({
      status: "all",
      provider: undefined,
      availableProviders: ["howen", "praxsys"],
      isNarrowed: false,
    });
    expect(
      result.fleets.flatMap((fleet) => fleet.vehicles.map((vehicle) => vehicle.vehicleId)),
    ).toEqual(["vehicle-1", "vehicle-2", "vehicle-3"]);
  });

  it("marks isNarrowed only when a status, provider, or search input is active", () => {
    expect(build().filters.isNarrowed).toBe(false);
    expect(build({ status: "offline" }).filters.isNarrowed).toBe(true);
    expect(build({ provider: "howen" }).filters.isNarrowed).toBe(true);
    expect(build({ searchTerm: "unit" }).filters.isNarrowed).toBe(true);
  });

  it("forces every surviving fleet open when a status or provider filter is active, even without a search term", () => {
    const result = build({ status: "en-route" });

    expect(result.fleets).toHaveLength(1);
    expect(result.fleets[0].isExpanded).toBe(true);
  });

  it("keeps counts and the provider list tied to the full roster even when a status filter narrows what is visible", () => {
    const result = build({ status: "en-route", expandedFleetIds: ["fleet-north"] });

    expect(result.fleets[0].counts).toEqual({ online: 1, total: 2 });
    expect(result.filters.availableProviders).toEqual(["howen", "praxsys"]);
  });

  it("suppresses speed for an offline vehicle even when stale telemetry stores a non-zero value", () => {
    const result = build({ expandedFleetIds: ["fleet-north"] });
    const vehicle2 = result.fleets[0].vehicles.find(
      (vehicle) => vehicle.vehicleId === "vehicle-2",
    );

    expect(vehicle2).toMatchObject({ status: "offline", speedKmH: undefined });
  });

  it("suppresses speed for an offline vehicle that never reported a stored speed at all", () => {
    const result = build({
      fleets: [
        {
          fleetId: "fleet-solo",
          label: "Solo Fleet",
          vehicleIds: ["vehicle-offline-no-speed"],
        },
      ],
      liveVehicles: [
        {
          vehicle: {
            id: "vehicle-offline-no-speed",
            customerId: "customer-1",
            fleetId: "fleet-solo",
            label: "No Speed Unit",
            isActive: true,
          },
          telemetry: { deviceId: "device-x", online: false },
        },
      ],
    });

    expect(result.fleets[0].vehicles[0]).toMatchObject({
      status: "offline",
      speedKmH: undefined,
    });
  });

  it("keeps a genuine zero speed for an online vehicle instead of treating it as absent", () => {
    const result = build({
      fleets: [
        {
          fleetId: "fleet-solo",
          label: "Solo Fleet",
          vehicleIds: ["vehicle-zero-speed"],
        },
      ],
      liveVehicles: [
        {
          vehicle: {
            id: "vehicle-zero-speed",
            customerId: "customer-1",
            fleetId: "fleet-solo",
            label: "Idle Unit",
            isActive: true,
          },
          telemetry: { deviceId: "device-y", online: true, speedKmH: 0 },
        },
      ],
    });

    expect(result.fleets[0].vehicles[0]).toMatchObject({
      status: "stopped",
      speedKmH: 0,
    });
  });

  it("renders absent fields, not zeroes, when a vehicle has no telemetry record at all", () => {
    const result = build({ expandedFleetIds: ["fleet-south"] });
    const vehicle3 = result.fleets.find((fleet) => fleet.fleetId === "fleet-south")
      ?.vehicles[0];

    expect(vehicle3).toMatchObject({
      status: "offline",
      speedKmH: undefined,
      lastReportAt: undefined,
    });
  });
});
