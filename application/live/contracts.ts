import type {
  Device,
  DeviceTelemetry,
  LiveMonitor,
  LiveTile,
  Vehicle,
} from "@/domain/live";

export type LiveVehicleState = {
  vehicle: Vehicle;
  device?: Device;
  telemetry?: DeviceTelemetry;
};

export type LiveSidebarViewModel = {
  search: {
    term: string;
    placeholder: string;
  };
  filters: {
    onlyActiveOrOnline: boolean;
  };
  fleets: LiveFleetNode[];
};

export type LiveFleetNode = {
  fleetId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  counts?: {
    total?: number;
    online?: number;
    offline?: number;
  };
  vehicles: LiveVehicleNode[];
};

export type LiveVehicleNode = {
  vehicleId: string;
  label: string;
  secondaryLabel?: string;
  isSelected: boolean;
  isOnline: boolean;
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

export type LiveMapViewModel = {
  markers: LiveMapMarker[];
  emptyState?: {
    code: "no-selection" | "no-mappable-selection";
    message: string;
  };
  capabilities?: {
    canFitBounds?: boolean;
  };
};

export type LiveBottomPanelViewModel = {
  activeTab: "status" | "event" | "normalAlarm" | "aiAlarm" | "driverSwipe";
  tabs: LiveBottomPanelTab[];
  emptyState?: {
    code: "no-selection";
    message: string;
  };
};

export type LiveBottomPanelTab = {
  key: "status" | "event" | "normalAlarm" | "aiAlarm" | "driverSwipe";
  label: string;
  columns: LiveTableColumn[];
  rows: LiveTableRow[];
};

export type LiveTableColumn = {
  key: string;
  label: string;
};

export type LiveTableRow = {
  vehicleId: string;
  cells: Record<string, string | number | boolean | null>;
};

export type LivePlaybackNotice = {
  code: "vehicle-offline" | "vehicle-no-video";
  message: string;
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
  expandedFleetIds?: string[];
  onlyActiveOrOnline?: boolean;
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

export type LiveDataSource = {
  readLiveState: () => LiveState;
  readBottomPanelTabs: () => LiveBottomPanelTab[];
};

export type BuildLivePageViewModelInput = {
  liveState: LiveState;
  selectedVehicleIds: string[];
  searchTerm: string;
  activeTab: LiveBottomPanelTab["key"];
  tabs: LiveBottomPanelTab[];
  expandedFleetIds?: string[];
  onlyActiveOrOnline?: boolean;
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
