import { describe, expect, it } from "vitest";

import type { BuildLivePageViewModelInput, LiveState } from "./contracts";
import { buildLiveBottomPanelViewModel } from "./build-live-bottom-panel-view-model";
import { buildLiveMapViewModel } from "./build-live-map-view-model";
import { buildLivePageViewModel } from "./build-live-page-view-model";
import { buildLiveSidebarViewModel } from "./build-live-sidebar-view-model";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const STALE_AFTER_MS = 5 * 60 * 1000;

const liveState: LiveState = {
  fleets: [
    { fleetId: "fleet-north", label: "North Fleet", vehicleIds: ["vehicle-1"] },
  ],
  liveVehicles: [
    {
      vehicle: {
        id: "vehicle-1",
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
  nowMs: NOW,
  staleAfterMs: STALE_AFTER_MS,
  activeTab: "status",
  tabs: [
    {
      key: "status",
      columns: [{ key: "speed" }],
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
        nowMs: input.nowMs,
        staleAfterMs: input.staleAfterMs,
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
      notice: { code: "vehicle-offline" },
    } as const;

    expect(buildLivePageViewModel({ ...input, playback }).playback).toEqual(
      playback,
    );
  });

  it("forwards sidebar-only options without touching the other surfaces", () => {
    const result = buildLivePageViewModel({
      ...input,
      expandedFleetIds: ["fleet-north"],
      status: "stopped",
    });

    expect(result.sidebar.fleets[0].isExpanded).toBe(true);
    expect(result.sidebar.filters.status).toBe("stopped");
    expect(result.bottomPanel).toEqual(buildLivePageViewModel(input).bottomPanel);
  });

  it("flows the status and provider filters to the sidebar unchanged", () => {
    const result = buildLivePageViewModel({
      ...input,
      status: "offline",
      provider: "demo",
    });

    expect(result.sidebar.filters.status).toBe("offline");
    expect(result.sidebar.filters.provider).toBe("demo");
  });
});
