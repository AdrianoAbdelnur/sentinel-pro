"use client";

import { useMemo, useState } from "react";

import {
  buildLivePageViewModel,
  type LiveBottomPanelTab,
  type LiveState,
  type OperationalSourceWarning,
} from "@/application/live";

import { LiveBottomPanel } from "./live-bottom-panel";
import { LiveMapPanel } from "./live-map-panel";
import { LiveSourceWarnings } from "./live-source-warnings";
import { LiveSidebar } from "./sidebar/live-sidebar";
import { useLiveSidebarFilters } from "./use-live-sidebar-filters";

type LiveScreenProps = {
  liveState: LiveState;
  tabs: LiveBottomPanelTab[];
  nowMs: number;
  staleAfterMs: number;
  warnings: OperationalSourceWarning[];
};

export function LiveScreen({
  liveState,
  tabs,
  nowMs,
  staleAfterMs,
  warnings,
}: LiveScreenProps) {
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [expandedFleetIds, setExpandedFleetIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<LiveBottomPanelTab["key"]>(
    tabs[0]?.key ?? "status",
  );

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);

  const {
    searchTerm,
    status,
    provider,
    setSearchTerm,
    setStatus,
    setProvider,
  } = useLiveSidebarFilters();

  const page = buildLivePageViewModel({
    liveState,
    selectedVehicleIds,
    searchTerm,
    activeTab,
    tabs,
    nowMs,
    staleAfterMs,
    expandedFleetIds,
    status,
    provider,
  });

  const vehicleLabels = useMemo(
    () =>
      Object.fromEntries(
        liveState.liveVehicles.map(({ vehicle }) => [
          vehicle.id,
          vehicle.label ?? vehicle.plate ?? "—",
        ]),
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
    <div className="flex min-h-0 flex-1 flex-col">
      <LiveSourceWarnings warnings={warnings} />

      <div className="flex min-h-0 flex-1">
        <LiveSidebar
          sidebar={page.sidebar}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
          onSearchChange={setSearchTerm}
          onStatusChange={setStatus}
          onProviderChange={setProvider}
          onToggleExpanded={toggleExpanded}
          onToggleFleet={toggleFleet}
          onToggleVehicle={toggleVehicle}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <LiveMapPanel map={page.map} />
          </div>

          <div className={isBottomPanelCollapsed ? "shrink-0" : "h-64 shrink-0"}>
            <LiveBottomPanel
              bottomPanel={page.bottomPanel}
              isCollapsed={isBottomPanelCollapsed}
              onToggleCollapsed={() =>
                setIsBottomPanelCollapsed((current) => !current)
              }
              vehicleLabels={vehicleLabels}
              onTabChange={setActiveTab}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
