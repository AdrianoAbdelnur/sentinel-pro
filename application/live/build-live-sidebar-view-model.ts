import { hasValidGps } from "@/domain/live";

import type {
  BuildLiveSidebarViewModelInput,
  LiveFleetNode,
  LiveSidebarViewModel,
  LiveVehicleNode,
  LiveVehicleState,
} from "./contracts";

const SEARCH_PLACEHOLDER = "Search by vehicle, plate or fleet";

export function buildLiveSidebarViewModel({
  fleets,
  liveVehicles,
  selectedVehicleIds,
  searchTerm,
  expandedFleetIds = [],
  onlyActiveOrOnline = false,
}: BuildLiveSidebarViewModelInput): LiveSidebarViewModel {
  const vehiclesById = new Map(
    liveVehicles.map((liveVehicle) => [liveVehicle.vehicle.id, liveVehicle]),
  );
  const selectedIds = new Set(selectedVehicleIds);
  const expandedIds = new Set(expandedFleetIds);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const fleetNodes = fleets.flatMap((fleet) => {
    const fleetVehicles = fleet.vehicleIds.flatMap((vehicleId) => {
      const liveVehicle = vehiclesById.get(vehicleId);

      if (!liveVehicle || (onlyActiveOrOnline && !isActiveOrOnline(liveVehicle))) {
        return [];
      }

      return [liveVehicle];
    });

    const fleetMatchesSearch = includes(fleet.label, normalizedSearch);
    const visibleVehicles = fleetMatchesSearch
      ? fleetVehicles
      : fleetVehicles.filter((liveVehicle) =>
          matchesVehicle(liveVehicle, normalizedSearch),
        );

    const isFiltering = normalizedSearch !== "" || onlyActiveOrOnline;

    if (isFiltering && visibleVehicles.length === 0) {
      return [];
    }

    const node: LiveFleetNode = {
      fleetId: fleet.fleetId,
      label: fleet.label,
      isExpanded: normalizedSearch
        ? true
        : expandedIds.has(fleet.fleetId),
      isSelected:
        fleetVehicles.length > 0 &&
        fleetVehicles.every((liveVehicle) =>
          selectedIds.has(liveVehicle.vehicle.id),
        ),
      vehicles: visibleVehicles.map((liveVehicle) =>
        toVehicleNode(liveVehicle, selectedIds),
      ),
    };

    return [node];
  });

  return {
    search: {
      term: searchTerm,
      placeholder: SEARCH_PLACEHOLDER,
    },
    filters: {
      onlyActiveOrOnline,
    },
    fleets: fleetNodes,
  };
}

function toVehicleNode(
  { vehicle, device, telemetry }: LiveVehicleState,
  selectedIds: Set<string>,
): LiveVehicleNode {
  const isOnline = telemetry?.online === true;

  return {
    vehicleId: vehicle.id,
    label: vehicle.label,
    secondaryLabel: vehicle.plate,
    isSelected: selectedIds.has(vehicle.id),
    isOnline,
    hasValidGps: hasValidGps(telemetry),
    canOpenLive: isOnline && device?.isActive === true,
  };
}

function isActiveOrOnline({ vehicle, telemetry }: LiveVehicleState): boolean {
  return vehicle.isActive || telemetry?.online === true;
}

function matchesVehicle(
  { vehicle }: LiveVehicleState,
  normalizedSearch: string,
): boolean {
  return (
    includes(vehicle.label, normalizedSearch) ||
    includes(vehicle.plate, normalizedSearch)
  );
}

function includes(value: string | undefined, normalizedSearch: string): boolean {
  if (!normalizedSearch) {
    return true;
  }

  return value?.toLowerCase().includes(normalizedSearch) ?? false;
}
