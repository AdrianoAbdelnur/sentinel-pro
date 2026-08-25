"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  liveState: initialLiveState,
  tabs,
  nowMs,
  staleAfterMs,
  warnings,
}: LiveScreenProps) {
  const [liveState, setLiveState] = useState(initialLiveState);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [expandedFleetIds, setExpandedFleetIds] = useState<string[]>(() =>
    initialLiveState.fleets.map((fleet) => fleet.fleetId),
  );
  const [loadingFleetIds, setLoadingFleetIds] = useState<string[]>([]);
  const fleetRequests = useRef(new Map<string, { generation: number; controller: AbortController; key: string }>());
  const fleetGenerations = useRef(new Map<string, number>());
  const pendingPageLoads = useRef(new Set<string>());
  const pageRequest = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });
  const [activeTab, setActiveTab] = useState<LiveBottomPanelTab["key"]>(
    tabs[0]?.key ?? "status",
  );

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(true);

  const invalidatePageRequest = useCallback(() => {
    pageRequest.current.controller?.abort();
    pageRequest.current = { generation: pageRequest.current.generation + 1 };
    for (const request of fleetRequests.current.values()) request.controller.abort();
    fleetRequests.current.clear();
    setLoadingFleetIds([]);
  }, []);

  const loadPage = useCallback(async (page: number, plate: string) => {
    const key = `${page}:${plate.trim()}`;
    if (pendingPageLoads.current.has(key)) return;
    pendingPageLoads.current.add(key);
    for (const request of fleetRequests.current.values()) request.controller.abort();
    fleetRequests.current.clear();
    setLoadingFleetIds([]);
    const generation = pageRequest.current.generation + 1;
    pageRequest.current.controller?.abort();
    const controller = new AbortController();
    pageRequest.current = { generation, controller };
    try {
      const loadedState = await fetchLivePage(page, plate, controller.signal);
      if (pageRequest.current.generation !== generation) return;
      setLiveState((current) => mergeLoadedPage(current, loadedState));
      setExpandedFleetIds(loadedState.fleets.map((fleet) => fleet.fleetId));
    } catch {
      return;
    } finally {
      pendingPageLoads.current.delete(key);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(1, "");
    return invalidatePageRequest;
  }, [invalidatePageRequest, loadPage]);

  const {
    searchTerm,
    status,
    provider,
    setSearchTerm,
    setStatus,
    setProvider,
  } = useLiveSidebarFilters();

  useEffect(() => {
    const interval = window.setInterval(async () => {
      await loadPage(liveState.pagination?.page ?? 1, searchTerm);
    }, 15_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [liveState.pagination?.page, searchTerm, loadPage]);

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

  async function loadFleet(fleetId: string, page = 1, plate = searchTerm) {
    const cacheKey = `${fleetId}:${page}:${plate.trim()}`;
    const previousRequest = fleetRequests.current.get(fleetId);
    if (previousRequest?.key === cacheKey) return;
    previousRequest?.controller.abort();
    pageRequest.current.controller?.abort();
    pageRequest.current = { generation: pageRequest.current.generation + 1 };
    const generation = (fleetGenerations.current.get(fleetId) ?? 0) + 1;
    fleetGenerations.current.set(fleetId, generation);
    const controller = new AbortController();
    fleetRequests.current.set(fleetId, { generation, controller, key: cacheKey });
    setLoadingFleetIds((current) => current.includes(fleetId) ? current : [...current, fleetId]);

    try {
      const params = new URLSearchParams({ page: String(page) });
      if (plate.trim()) params.set("plate", plate.trim());
      const response = await fetch(`/api/live/groups/${encodeURIComponent(fleetId)}/vehicles?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Group vehicles unavailable");
      const loadedState = (await response.json()) as LiveState;
      if (fleetRequests.current.get(fleetId)?.generation !== generation) return;
      setLiveState((current) => mergeLoadedFleet(current, loadedState, fleetId));
    } catch {
      if (fleetRequests.current.get(fleetId)?.generation === generation) {
        setExpandedFleetIds((current) => current.filter((id) => id !== fleetId));
      }
    } finally {
      if (fleetRequests.current.get(fleetId)?.generation === generation) {
        fleetRequests.current.delete(fleetId);
        setLoadingFleetIds((current) => current.filter((id) => id !== fleetId));
      }
    }
  }

  function handleSearchChange(term: string) {
    setSearchTerm(term);
    void loadPage(1, term);
  }

  function toggleFleet(fleetId: string) {
    const fleet = liveState.fleets.find((candidate) => candidate.fleetId === fleetId);
    if (fleet?.isLoaded === false) {
      setExpandedFleetIds((current) => current.includes(fleetId) ? current : [...current, fleetId]);
      void loadFleet(fleetId);
      return;
    }

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
    const fleet = liveState.fleets.find((candidate) => candidate.fleetId === fleetId);
    if (fleet?.isLoaded === false && !expandedFleetIds.includes(fleetId)) {
      void loadFleet(fleetId);
    }
    setExpandedFleetIds((current) =>
      current.includes(fleetId)
        ? current.filter((id) => id !== fleetId)
        : [...current, fleetId],
    );
  }

  function changeFleetPage(fleetId: string, page: number) {
    void loadFleet(fleetId, page);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LiveSourceWarnings warnings={warnings} />

      <div className="flex min-h-0 flex-1">
        <LiveSidebar
          sidebar={page.sidebar}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
          onSearchChange={handleSearchChange}
          onStatusChange={setStatus}
          onProviderChange={setProvider}
          onToggleExpanded={toggleExpanded}
          onToggleFleet={toggleFleet}
          onToggleVehicle={toggleVehicle}
          onFleetPageChange={changeFleetPage}
          pagination={liveState.pagination}
          onPageChange={(page) => void loadPage(page, searchTerm)}
          loadingFleetIds={loadingFleetIds}
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

async function fetchLivePage(page: number, plate: string, signal?: AbortSignal): Promise<LiveState> {
  const query = new URLSearchParams({ page: String(page) });
  if (plate.trim()) query.set("plate", plate.trim());
  const response = await fetch(`/api/live/vehicles?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Live vehicles unavailable");
  return (await response.json()) as LiveState;
}

export function mergeLoadedPage(current: LiveState, loaded: LiveState): LiveState {
  return {
    ...current,
    ...loaded,
    fleets: loaded.fleets,
    liveVehicles: loaded.liveVehicles,
  };
}

function mergeLoadedFleet(current: LiveState, loaded: LiveState, fleetId: string): LiveState {
  const loadedFleet = loaded.fleets.find((fleet) => fleet.fleetId === fleetId);
  if (!loadedFleet) return current;

  return {
    fleets: current.fleets.map((fleet) => fleet.fleetId === fleetId ? loadedFleet : fleet),
    liveVehicles: [
      ...current.liveVehicles.filter(({ vehicle }) => vehicle.fleetId !== fleetId),
      ...loaded.liveVehicles,
    ],
  };
}
