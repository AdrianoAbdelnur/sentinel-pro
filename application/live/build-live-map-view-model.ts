import { hasValidGps } from "@/domain/live";

import type { BuildLiveMapViewModelInput, LiveMapViewModel } from "./contracts";

export function buildLiveMapViewModel({
  selectedVehicleIds,
  liveVehicles,
}: BuildLiveMapViewModelInput): LiveMapViewModel {
  if (selectedVehicleIds.length === 0) {
    return {
      markers: [],
      emptyState: {
        code: "no-selection",
        message: "Select at least one vehicle to view it on the map.",
      },
    };
  }

  const selectedIds = new Set(selectedVehicleIds);
  const markers = liveVehicles.flatMap(({ vehicle, telemetry }) => {
    if (!selectedIds.has(vehicle.id) || !hasValidGps(telemetry)) {
      return [];
    }

    return [
      {
        vehicleId: vehicle.id,
        label: vehicle.label,
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        headingDeg: telemetry.headingDeg,
        speedKmH: telemetry.speedKmH,
      },
    ];
  });

  if (markers.length === 0) {
    return {
      markers: [],
      emptyState: {
        code: "no-mappable-selection",
        message: "The selected vehicles do not have valid GPS coordinates.",
      },
    };
  }

  return {
    markers,
  };
}
