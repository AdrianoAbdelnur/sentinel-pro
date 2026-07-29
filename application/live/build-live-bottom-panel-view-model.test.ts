import { describe, expect, it } from "vitest";

import type { LiveBottomPanelTab, LiveVehicleState } from "./contracts";
import { buildLiveBottomPanelViewModel } from "./build-live-bottom-panel-view-model";

const liveVehicles: LiveVehicleState[] = [
  {
    vehicle: {
      id: "vehicle-1",
      customerId: "customer-1",
      fleetId: "fleet-north",
      label: "Unit 101",
      isActive: true,
    },
  },
  {
    vehicle: {
      id: "vehicle-2",
      customerId: "customer-1",
      fleetId: "fleet-north",
      label: "Unit 102",
      isActive: true,
    },
  },
];

const tabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    columns: [{ key: "speed" }, { key: "ignition" }],
    rows: [
      { vehicleId: "vehicle-1", cells: { speed: 45, ignition: true } },
      { vehicleId: "vehicle-2", cells: { speed: 0 } },
    ],
  },
  {
    key: "event",
    columns: [{ key: "lastEvent" }],
    rows: [{ vehicleId: "vehicle-1", cells: { lastEvent: "Harsh braking" } }],
  },
];

function build(
  overrides: Partial<Parameters<typeof buildLiveBottomPanelViewModel>[0]> = {},
) {
  return buildLiveBottomPanelViewModel({
    selectedVehicleIds: [],
    liveVehicles,
    activeTab: "status",
    tabs,
    ...overrides,
  });
}

describe("buildLiveBottomPanelViewModel", () => {
  it("returns the no-selection empty state when nothing is selected", () => {
    const result = build();

    expect(result.emptyState).toEqual({
      code: "no-selection",
    });
  });

  it("keeps tab columns but no rows when nothing is selected", () => {
    const result = build();

    expect(result.tabs.map((tab) => [tab.key, tab.rows])).toEqual([
      ["status", []],
      ["event", []],
    ]);
    expect(result.tabs[0].columns).toEqual(tabs[0].columns);
  });

  it("fills missing cells with null so delivery can render its own fallback", () => {
    const result = build({ selectedVehicleIds: ["vehicle-1", "vehicle-2"] });

    expect(result.tabs[0].rows).toEqual([
      { vehicleId: "vehicle-1", cells: { speed: 45, ignition: true } },
      { vehicleId: "vehicle-2", cells: { speed: 0, ignition: null } },
    ]);
    expect(result.emptyState).toBeUndefined();
  });

  it("still emits a row for a selected vehicle absent from the dataset", () => {
    const result = build({ selectedVehicleIds: ["vehicle-1", "vehicle-2"] });

    expect(result.tabs[1].rows).toEqual([
      { vehicleId: "vehicle-1", cells: { lastEvent: "Harsh braking" } },
      { vehicleId: "vehicle-2", cells: { lastEvent: null } },
    ]);
  });

  it("orders rows by the selection order", () => {
    const result = build({ selectedVehicleIds: ["vehicle-2", "vehicle-1"] });

    expect(result.tabs[0].rows.map((row) => row.vehicleId)).toEqual([
      "vehicle-2",
      "vehicle-1",
    ]);
  });

  it("ignores selected ids that are not known live vehicles", () => {
    const result = build({ selectedVehicleIds: ["vehicle-1", "ghost-vehicle"] });

    expect(result.tabs[0].rows.map((row) => row.vehicleId)).toEqual(["vehicle-1"]);
  });

  it("keeps the same selected vehicle scope across tabs when the active tab changes", () => {
    const selectedVehicleIds = ["vehicle-1", "vehicle-2"];
    const onStatus = build({ selectedVehicleIds, activeTab: "status" });
    const onEvent = build({ selectedVehicleIds, activeTab: "event" });

    expect(onStatus.activeTab).toBe("status");
    expect(onEvent.activeTab).toBe("event");

    const scopeOf = (result: ReturnType<typeof build>) =>
      result.tabs.map((tab) => tab.rows.map((row) => row.vehicleId));

    expect(scopeOf(onEvent)).toEqual(scopeOf(onStatus));
    expect(scopeOf(onStatus)).toEqual([
      ["vehicle-1", "vehicle-2"],
      ["vehicle-1", "vehicle-2"],
    ]);
  });
});
