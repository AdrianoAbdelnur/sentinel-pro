import type { LiveMonitor } from "@/domain/live";

import type { OpenVehicleLiveInput, OpenVehicleLiveResult } from "./contracts";

const DEFAULT_GRID_SIZE: LiveMonitor["gridSize"] = 4;

export function openVehicleLive({
  vehicleId,
  currentMonitor,
  openedVehicleIds = [],
  defaultGridSize = DEFAULT_GRID_SIZE,
  resolveVehiclePlayback,
}: OpenVehicleLiveInput): OpenVehicleLiveResult {
  if (openedVehicleIds.includes(vehicleId)) {
    return {
      kind: "noop",
      reason: "already-open",
    };
  }

  const resolution = resolveVehiclePlayback(vehicleId);

  if (resolution.kind === "offline") {
    return {
      kind: "show-notice",
      notice: {
        code: "vehicle-offline",
      },
    };
  }

  if (resolution.kind === "no-video") {
    return {
      kind: "show-notice",
      notice: {
        code: "vehicle-no-video",
      },
    };
  }

  return {
    kind: "append-tiles",
    monitor: {
      gridSize: currentMonitor?.gridSize ?? defaultGridSize,
      tiles: [...(currentMonitor?.tiles ?? []), ...resolution.tiles],
    },
  };
}
