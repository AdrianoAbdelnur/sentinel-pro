import { DEFAULT_STALE_AFTER_MS, hasValidGps, resolveVehicleStatus } from "@/domain/live";

import type { BuildLiveMapViewModelInput, LiveMapViewModel } from "./contracts";

export function buildLiveMapViewModel({
  selectedVehicleIds,
  liveVehicles,
  nowMs = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
}: BuildLiveMapViewModelInput): LiveMapViewModel {
  if (selectedVehicleIds.length === 0) {
    return {
      markers: [],
      emptyState: {
        code: "no-selection",
      },
    };
  }

  const selectedIds = new Set(selectedVehicleIds);
  const markers = liveVehicles.flatMap(({ vehicle, telemetry }) => {
    if (!selectedIds.has(vehicle.id) || !hasValidGps(telemetry)) {
      return [];
    }

    const isOffline = resolveVehicleStatus({ telemetry, nowMs, staleAfterMs }) === "offline";

    return [
      {
        vehicleId: vehicle.id,
        label: vehicle.label ?? vehicle.plate ?? "",
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        headingDeg: telemetry.headingDeg,
        ...(isOffline ? { status: "offline" as const } : {}),
        speedKmH: isOffline ? undefined : telemetry.speedKmH,
      },
    ];
  });

  if (markers.length === 0) {
    return {
      markers: [],
      emptyState: {
        code: "no-mappable-selection",
      },
    };
  }

  return {
    markers,
  };
}
