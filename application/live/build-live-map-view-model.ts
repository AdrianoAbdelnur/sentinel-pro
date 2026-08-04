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
        label: vehicle.label ?? vehicle.plate ?? "",
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
      },
    };
  }

  return {
    markers,
  };
}
