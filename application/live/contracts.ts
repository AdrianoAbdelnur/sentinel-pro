import type {
  Device,
  DeviceTelemetry,
  LiveMonitor,
  LiveTile,
  Vehicle,
  VehicleStatus,
} from "@/domain/live";

export type { VehicleStatus };

export type LiveVehicleState = {
  vehicle: Vehicle;
  device?: Device;
  telemetry?: DeviceTelemetry;
};

export type LiveStatusFilter = "all" | VehicleStatus;

export type LiveSidebarViewModel = {
  search: {
    term: string;
  };
  filters: {
    status: LiveStatusFilter;
    provider?: string;
    availableProviders: string[];
    isNarrowed: boolean;
  };
  fleets: LiveFleetNode[];
};

export type LiveFleetNode = {
  fleetId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  counts: {
    online: number;
    total: number;
  };
  vehicles: LiveVehicleNode[];
};

export type LiveVehicleNode = {
  vehicleId: string;
  plate?: string;
  label?: string;
  status: VehicleStatus;
  speedKmH?: number;
  lastReportAt?: string;
  provider?: string;
  isSelected: boolean;
  hasValidGps: boolean;
  canOpenLive: boolean;
};

export type LiveMapMarker = {
  vehicleId: string;
  label: string;
  latitude: number;
  longitude: number;
  headingDeg?: number;
  speedKmH?: number;
};

export type LiveMapEmptyStateCode = "no-selection" | "no-mappable-selection";

export type LiveMapViewModel = {
  markers: LiveMapMarker[];
  emptyState?: {
    code: LiveMapEmptyStateCode;
  };
  capabilities?: {
    canFitBounds?: boolean;
  };
};

export type LiveBottomPanelEmptyStateCode = "no-selection";

export type LiveBottomPanelViewModel = {
  activeTab: "status" | "event" | "normalAlarm" | "aiAlarm" | "driverSwipe";
  tabs: LiveBottomPanelTab[];
  emptyState?: {
    code: LiveBottomPanelEmptyStateCode;
  };
};

export type LiveBottomPanelTab = {
  key: "status" | "event" | "normalAlarm" | "aiAlarm" | "driverSwipe";
  columns: LiveTableColumn[];
  rows: LiveTableRow[];
};

export type LiveTableColumn = {
  key: string;
};

export type LiveTableRow = {
  vehicleId: string;
  cells: Record<string, string | number | boolean | null>;
};

export type LivePlaybackNoticeCode = "vehicle-offline" | "vehicle-no-video";

export type LivePlaybackNotice = {
  code: LivePlaybackNoticeCode;
};

export type LivePlaybackOverlayViewModel = {
  isOpen: boolean;
  monitor?: LiveMonitor;
  notice?: LivePlaybackNotice;
};

export type LivePageViewModel = {
  sidebar: LiveSidebarViewModel;
  map: LiveMapViewModel;
  bottomPanel: LiveBottomPanelViewModel;
  playback: LivePlaybackOverlayViewModel;
};

export type BuildLiveMapViewModelInput = {
  selectedVehicleIds: string[];
  liveVehicles: LiveVehicleState[];
};

export type LiveFleetState = {
  fleetId: string;
  label: string;
  vehicleIds: string[];
};

export type BuildLiveSidebarViewModelInput = {
  fleets: LiveFleetState[];
  liveVehicles: LiveVehicleState[];
  selectedVehicleIds: string[];
  searchTerm: string;
  nowMs: number;
  staleAfterMs: number;
  expandedFleetIds?: string[];
  status?: LiveStatusFilter;
  provider?: string;
};

export type BuildLiveBottomPanelViewModelInput = {
  selectedVehicleIds: string[];
  liveVehicles: LiveVehicleState[];
  activeTab: LiveBottomPanelTab["key"];
  tabs: LiveBottomPanelTab[];
};

export type LiveState = {
  fleets: LiveFleetState[];
  liveVehicles: LiveVehicleState[];
};

export type OperationalSourceIdentity = {
  id: string;
  label: string;
};

export type OperationalSourceFailureCode = "unavailable";

export type OperationalSourceResult =
  | { kind: "success"; state: LiveState }
  | { kind: "failure"; code: OperationalSourceFailureCode };

export type OperationalSource = {
  identity: OperationalSourceIdentity;
  loadSnapshot(): Promise<OperationalSourceResult>;
};

export type OperationalSourceWarning = {
  code: "source-unavailable";
  sourceId: string;
  sourceLabel: string;
};

export type OperationalSnapshot = {
  state: LiveState;
  warnings: OperationalSourceWarning[];
};

export type BuildLivePageViewModelInput = {
  liveState: LiveState;
  selectedVehicleIds: string[];
  searchTerm: string;
  activeTab: LiveBottomPanelTab["key"];
  tabs: LiveBottomPanelTab[];
  nowMs: number;
  staleAfterMs: number;
  expandedFleetIds?: string[];
  status?: LiveStatusFilter;
  provider?: string;
  playback?: LivePlaybackOverlayViewModel;
};

export type ResolveVehiclePlaybackResult =
  | {
      kind: "playable";
      tiles: LiveTile[];
    }
  | {
      kind: "offline";
    }
  | {
      kind: "no-video";
    };

export type ResolveVehiclePlayback = (
  vehicleId: string,
) => ResolveVehiclePlaybackResult;

export type OpenVehicleLiveInput = {
  vehicleId: string;
  currentMonitor?: LiveMonitor;
  openedVehicleIds?: string[];
  defaultGridSize?: LiveMonitor["gridSize"];
  resolveVehiclePlayback: ResolveVehiclePlayback;
};

export type OpenVehicleLiveResult =
  | {
      kind: "append-tiles";
      monitor: LiveMonitor;
    }
  | {
      kind: "show-notice";
      notice: LivePlaybackNotice;
    }
  | {
      kind: "noop";
      reason: "already-open";
    };
