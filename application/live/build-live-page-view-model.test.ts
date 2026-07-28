import { describe, expect, it } from "vitest";

import type { BuildLivePageViewModelInput, LiveState } from "./contracts";
import { buildLiveBottomPanelViewModel } from "./build-live-bottom-panel-view-model";
import { buildLiveMapViewModel } from "./build-live-map-view-model";
import { buildLivePageViewModel } from "./build-live-page-view-model";
import { buildLiveSidebarViewModel } from "./build-live-sidebar-view-model";

const liveState: LiveState = {
  fleets: [
    { fleetId: "fleet-north", label: "North Fleet", vehicleIds: ["vehicle-1"] },
  ],
  liveVehicles: [
    {
      vehicle: {
        id: "vehicle-1",
        customerId: "customer-1",
        fleetId: "fleet-north",
        label: "Unit 101",
        plate: "ABC123",
        isActive: true,
      },
      telemetry: {
        deviceId: "device-1",
        online: true,
        latitude: -34.6,
        longitude: -58.4,
      },
    },
  ],
};

const input: BuildLivePageViewModelInput = {
  liveState,
  selectedVehicleIds: ["vehicle-1"],
  searchTerm: "",
  activeTab: "status",
  tabs: [
    {
      key: "status",
      label: "Status",
      columns: [{ key: "speed", label: "Speed" }],
      rows: [{ vehicleId: "vehicle-1", cells: { speed: 45 } }],
    },
  ],
};

describe("buildLivePageViewModel", () => {
  it("exposes every operator surface", () => {
    const result = buildLivePageViewModel(input);

    expect(Object.keys(result).sort()).toEqual([
      "bottomPanel",
      "map",
      "playback",
      "sidebar",
    ]);
  });

  it("delegates the sidebar to the sidebar use case", () => {
    expect(buildLivePageViewModel(input).sidebar).toEqual(
      buildLiveSidebarViewModel({
        fleets: liveState.fleets,
        liveVehicles: liveState.liveVehicles,
        selectedVehicleIds: input.selectedVehicleIds,
        searchTerm: input.searchTerm,
      }),
    );
  });

  it("delegates the bottom panel to the bottom panel use case", () => {
    expect(buildLivePageViewModel(input).bottomPanel).toEqual(
      buildLiveBottomPanelViewModel({
        selectedVehicleIds: input.selectedVehicleIds,
        liveVehicles: liveState.liveVehicles,
        activeTab: input.activeTab,
        tabs: input.tabs,
      }),
    );
  });

  it("delegates the map to the map use case", () => {
    expect(buildLivePageViewModel(input).map).toEqual(
      buildLiveMapViewModel({
        selectedVehicleIds: input.selectedVehicleIds,
        liveVehicles: liveState.liveVehicles,
      }),
    );
  });

  it("returns a closed playback overlay by default", () => {
    expect(buildLivePageViewModel(input).playback).toEqual({ isOpen: false });
  });

  it("keeps the playback overlay it was given", () => {
    const playback = {
      isOpen: true,
      notice: { code: "vehicle-offline", message: "Vehicle offline." },
    } as const;

    expect(buildLivePageViewModel({ ...input, playback }).playback).toEqual(
      playback,
    );
  });

  it("forwards sidebar-only options without touching the other surfaces", () => {
    const result = buildLivePageViewModel({
      ...input,
      expandedFleetIds: ["fleet-north"],
      onlyActiveOrOnline: true,
    });

    expect(result.sidebar.fleets[0].isExpanded).toBe(true);
    expect(result.sidebar.filters.onlyActiveOrOnline).toBe(true);
    expect(result.bottomPanel).toEqual(buildLivePageViewModel(input).bottomPanel);
  });
});
