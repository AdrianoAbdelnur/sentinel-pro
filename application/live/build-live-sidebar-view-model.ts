import { hasValidGps, resolveVehicleStatus } from "@/domain/live";

import type {
  BuildLiveSidebarViewModelInput,
  LiveFleetNode,
  LiveSidebarViewModel,
  LiveVehicleNode,
  LiveVehicleState,
  VehicleStatus,
} from "./contracts";

const NO_STATUS_NARROWING = "all" as const;

export function buildLiveSidebarViewModel({
  fleets,
  liveVehicles,
  selectedVehicleIds,
  searchTerm,
  nowMs,
  staleAfterMs,
  expandedFleetIds = [],
  status = NO_STATUS_NARROWING,
  provider,
}: BuildLiveSidebarViewModelInput): LiveSidebarViewModel {
  const selectedIds = new Set(selectedVehicleIds);
  const expandedIds = new Set(expandedFleetIds);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const vehiclesById = new Map(
    liveVehicles.map((liveVehicle) => [liveVehicle.vehicle.id, liveVehicle]),
  );

  // Resolved once per vehicle so counts, narrowing and node composition all
  // read the exact same value.
  const statusByVehicleId = new Map<string, VehicleStatus>(
    liveVehicles.map(({ vehicle, telemetry }) => [
      vehicle.id,
      resolveVehicleStatus({ telemetry, nowMs, staleAfterMs }),
    ]),
  );

  // Over the entire vehicle set, before narrowing: selecting a provider must
  // not remove the other options from the dropdown.
  const availableProviders = Array.from(
    new Set(
      liveVehicles
        .map(({ device }) => device?.provider)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();

  const isNarrowed =
    status !== NO_STATUS_NARROWING ||
    provider !== undefined ||
    normalizedSearch !== "";

  const fleetNodes = fleets.flatMap((fleet) => {
    // Counts and `isSelected` must be computed from this list, never from a
    // narrowed one: a partially-selected fleet would otherwise read as fully
    // selected once its hidden, unselected vehicles were filtered out.
    const fullRoster = fleet.vehicleIds.flatMap((vehicleId) => {
      const liveVehicle = vehiclesById.get(vehicleId);
      return liveVehicle ? [liveVehicle] : [];
    });

    const onlineCount = fullRoster.filter(
      (liveVehicle) =>
        statusByVehicleId.get(liveVehicle.vehicle.id) !== "offline",
    ).length;

    const isSelected =
      fullRoster.length > 0 &&
      fullRoster.every((liveVehicle) => selectedIds.has(liveVehicle.vehicle.id));

    const statusFiltered = fullRoster.filter(
      (liveVehicle) =>
        status === NO_STATUS_NARROWING ||
        statusByVehicleId.get(liveVehicle.vehicle.id) === status,
    );
    const providerFiltered = statusFiltered.filter(
      (liveVehicle) =>
        provider === undefined || liveVehicle.device?.provider === provider,
    );

    const fleetMatchesSearch = includes(fleet.label, normalizedSearch);
    const visibleVehicles = fleetMatchesSearch
      ? providerFiltered
      : providerFiltered.filter((liveVehicle) =>
          matchesVehicle(liveVehicle, normalizedSearch),
        );

    if (isNarrowed && visibleVehicles.length === 0) {
      return [];
    }

    const node: LiveFleetNode = {
      fleetId: fleet.fleetId,
      label: fleet.label,
      isExpanded: isNarrowed ? true : expandedIds.has(fleet.fleetId),
      isSelected,
      counts: {
        online: onlineCount,
        total: fullRoster.length,
      },
      vehicles: visibleVehicles.map((liveVehicle) =>
        toVehicleNode(liveVehicle, selectedIds, statusByVehicleId),
      ),
    };

    return [node];
  });

  return {
    search: {
      term: searchTerm,
    },
    filters: {
      status,
      provider,
      availableProviders,
      isNarrowed,
    },
    fleets: fleetNodes,
  };
}

function toVehicleNode(
  { vehicle, device, telemetry }: LiveVehicleState,
  selectedIds: Set<string>,
  statusByVehicleId: Map<string, VehicleStatus>,
): LiveVehicleNode {
  const vehicleStatus = statusByVehicleId.get(vehicle.id) ?? "offline";

  // Stale telemetry can still carry a speed; an offline node must not expose it.
  const speedKmH = vehicleStatus === "offline" ? undefined : telemetry?.speedKmH;

  return {
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    label: vehicle.label,
    status: vehicleStatus,
    speedKmH,
    lastReportAt: telemetry?.gpsAt,
    provider: device?.provider,
    isSelected: selectedIds.has(vehicle.id),
    hasValidGps: hasValidGps(telemetry),
    canOpenLive: vehicleStatus !== "offline" && device?.isActive === true,
  };
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
