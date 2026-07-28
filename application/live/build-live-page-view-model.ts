import { buildLiveBottomPanelViewModel } from "./build-live-bottom-panel-view-model";
import { buildLiveMapViewModel } from "./build-live-map-view-model";
import { buildLiveSidebarViewModel } from "./build-live-sidebar-view-model";
import type {
  BuildLivePageViewModelInput,
  LivePageViewModel,
} from "./contracts";

const CLOSED_PLAYBACK = { isOpen: false } as const;

export function buildLivePageViewModel({
  liveState,
  selectedVehicleIds,
  searchTerm,
  activeTab,
  tabs,
  expandedFleetIds,
  onlyActiveOrOnline,
  playback = CLOSED_PLAYBACK,
}: BuildLivePageViewModelInput): LivePageViewModel {
  const { fleets, liveVehicles } = liveState;

  return {
    sidebar: buildLiveSidebarViewModel({
      fleets,
      liveVehicles,
      selectedVehicleIds,
      searchTerm,
      expandedFleetIds,
      onlyActiveOrOnline,
    }),
    map: buildLiveMapViewModel({
      selectedVehicleIds,
      liveVehicles,
    }),
    bottomPanel: buildLiveBottomPanelViewModel({
      selectedVehicleIds,
      liveVehicles,
      activeTab,
      tabs,
    }),
    playback,
  };
}
