"use client";

import { useMemo, useState } from "react";

import {
  buildLivePageViewModel,
  type LiveBottomPanelTab,
  type LiveState,
} from "@/application/live";

import { LiveBottomPanel } from "./live-bottom-panel";
import { LiveSidebar } from "./live-sidebar";

type LiveScreenProps = {
  liveState: LiveState;
  tabs: LiveBottomPanelTab[];
};

export function LiveScreen({ liveState, tabs }: LiveScreenProps) {
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [expandedFleetIds, setExpandedFleetIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActiveOrOnline, setOnlyActiveOrOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<LiveBottomPanelTab["key"]>(
    tabs[0]?.key ?? "status",
  );

  const page = buildLivePageViewModel({
    liveState,
    selectedVehicleIds,
    searchTerm,
    activeTab,
    tabs,
    expandedFleetIds,
    onlyActiveOrOnline,
  });

  const vehicleLabels = useMemo(
    () =>
      Object.fromEntries(
        liveState.liveVehicles.map(({ vehicle }) => [vehicle.id, vehicle.label]),
      ),
    [liveState],
  );

  function toggleVehicle(vehicleId: string) {
    setSelectedVehicleIds((current) =>
      current.includes(vehicleId)
        ? current.filter((id) => id !== vehicleId)
        : [...current, vehicleId],
    );
  }

  function toggleFleet(fleetId: string) {
    const fleetVehicleIds =
      liveState.fleets.find((fleet) => fleet.fleetId === fleetId)?.vehicleIds ??
      [];

    setSelectedVehicleIds((current) => {
      const isFullySelected =
        fleetVehicleIds.length > 0 &&
        fleetVehicleIds.every((id) => current.includes(id));

      if (isFullySelected) {
        return current.filter((id) => !fleetVehicleIds.includes(id));
      }

      return [
        ...current,
        ...fleetVehicleIds.filter((id) => !current.includes(id)),
      ];
    });
  }

  function toggleExpanded(fleetId: string) {
    setExpandedFleetIds((current) =>
      current.includes(fleetId)
        ? current.filter((id) => id !== fleetId)
        : [...current, fleetId],
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <LiveSidebar
        sidebar={page.sidebar}
        onSearchChange={setSearchTerm}
        onFilterChange={setOnlyActiveOrOnline}
        onToggleExpanded={toggleExpanded}
        onToggleFleet={toggleFleet}
        onToggleVehicle={toggleVehicle}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-900/40 px-6 text-center text-sm text-zinc-500">
          Map view arrives in a later change.
        </div>

        <div className="h-64 shrink-0">
          <LiveBottomPanel
            bottomPanel={page.bottomPanel}
            vehicleLabels={vehicleLabels}
            onTabChange={setActiveTab}
          />
        </div>
      </div>
    </div>
  );
}
