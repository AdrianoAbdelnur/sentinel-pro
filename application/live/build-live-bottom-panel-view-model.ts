import type {
  BuildLiveBottomPanelViewModelInput,
  LiveBottomPanelTab,
  LiveBottomPanelViewModel,
  LiveTableRow,
} from "./contracts";

export function buildLiveBottomPanelViewModel({
  selectedVehicleIds,
  liveVehicles,
  activeTab,
  tabs,
}: BuildLiveBottomPanelViewModelInput): LiveBottomPanelViewModel {
  const knownVehicleIds = new Set(
    liveVehicles.map((liveVehicle) => liveVehicle.vehicle.id),
  );
  const scopedVehicleIds = selectedVehicleIds.filter((vehicleId) =>
    knownVehicleIds.has(vehicleId),
  );

  const composedTabs = tabs.map((tab) => ({
    ...tab,
    rows: composeRows(tab, scopedVehicleIds),
  }));

  if (scopedVehicleIds.length === 0) {
    return {
      activeTab,
      tabs: composedTabs,
      emptyState: {
        code: "no-selection",
        message: "Select at least one vehicle to view its data.",
      },
    };
  }

  return {
    activeTab,
    tabs: composedTabs,
  };
}

function composeRows(
  tab: LiveBottomPanelTab,
  scopedVehicleIds: string[],
): LiveTableRow[] {
  const rowsByVehicleId = new Map(tab.rows.map((row) => [row.vehicleId, row]));

  return scopedVehicleIds.map((vehicleId) => {
    const cells = rowsByVehicleId.get(vehicleId)?.cells ?? {};

    return {
      vehicleId,
      cells: Object.fromEntries(
        tab.columns.map((column) => [column.key, cells[column.key] ?? null]),
      ),
    };
  });
}
