import { describe, expect, it } from "vitest";

import type { LiveTile } from "@/domain/live";

import { openVehicleLive } from "./open-vehicle-live";

const playableTiles: LiveTile[] = [
  {
    id: "tile-1",
    deviceId: "device-1",
    provider: "howen",
    channel: 1,
    renderer: "hls",
    sourceUrl: "https://example.test/live/1.m3u8",
    status: "ready",
    label: "Front Camera",
  },
];

describe("openVehicleLive", () => {
  it("appends tiles when the vehicle has playable video", () => {
    const result = openVehicleLive({
      vehicleId: "vehicle-1",
      currentMonitor: undefined,
      resolveVehiclePlayback: () => ({
        kind: "playable",
        tiles: playableTiles,
      }),
    });

    expect(result).toEqual({
      kind: "append-tiles",
      monitor: {
        gridSize: 4,
        tiles: playableTiles,
      },
    });
  });

  it("appends onto the tiles already open and keeps the current grid size", () => {
    const existingTile: LiveTile = {
      id: "tile-0",
      deviceId: "device-0",
      provider: "howen",
      channel: 1,
      renderer: "hls",
      sourceUrl: "https://example.test/live/0.m3u8",
      status: "ready",
    };

    const result = openVehicleLive({
      vehicleId: "vehicle-2",
      currentMonitor: {
        gridSize: 9,
        tiles: [existingTile],
      },
      openedVehicleIds: ["vehicle-1"],
      defaultGridSize: 4,
      resolveVehiclePlayback: () => ({
        kind: "playable",
        tiles: playableTiles,
      }),
    });

    expect(result).toEqual({
      kind: "append-tiles",
      monitor: {
        gridSize: 9,
        tiles: [existingTile, ...playableTiles],
      },
    });
  });

  it("returns noop when the vehicle is already open", () => {
    const result = openVehicleLive({
      vehicleId: "vehicle-1",
      currentMonitor: {
        gridSize: 9,
        tiles: playableTiles,
      },
      openedVehicleIds: ["vehicle-1"],
      resolveVehiclePlayback: () => ({
        kind: "playable",
        tiles: playableTiles,
      }),
    });

    expect(result).toEqual({
      kind: "noop",
      reason: "already-open",
    });
  });

  it("returns an offline notice when the resolver reports an offline vehicle", () => {
    const result = openVehicleLive({
      vehicleId: "vehicle-2",
      currentMonitor: {
        gridSize: 4,
        tiles: [],
      },
      openedVehicleIds: [],
      resolveVehiclePlayback: () => ({
        kind: "offline",
      }),
    });

    expect(result).toEqual({
      kind: "show-notice",
      notice: {
        code: "vehicle-offline",
      },
    });
  });

  it("returns a no-video notice when the resolver reports unavailable playback", () => {
    const result = openVehicleLive({
      vehicleId: "vehicle-3",
      currentMonitor: {
        gridSize: 4,
        tiles: [],
      },
      openedVehicleIds: [],
      resolveVehiclePlayback: () => ({
        kind: "no-video",
      }),
    });

    expect(result).toEqual({
      kind: "show-notice",
      notice: {
        code: "vehicle-no-video",
      },
    });
  });
});
