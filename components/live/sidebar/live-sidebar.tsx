import type { LiveSidebarViewModel, LiveStatusFilter } from "@/application/live";

import { CollapseToggle } from "../collapse-toggle";
import { LiveFleetNode } from "./live-fleet-node";
import { LiveSidebarFilters } from "./live-sidebar-filters";

export const EMPTY_FLEETS_LABEL = "Ningún resultado coincide con la búsqueda.";
export const COLLAPSE_SIDEBAR_LABEL = "Contraer panel de unidades";
export const EXPAND_SIDEBAR_LABEL = "Expandir panel de unidades";

type LiveSidebarProps = {
  sidebar: LiveSidebarViewModel;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSearchChange: (term: string) => void;
  onStatusChange: (status: LiveStatusFilter) => void;
  onProviderChange: (provider: string | undefined) => void;
  onToggleExpanded: (fleetId: string) => void;
  onToggleFleet: (fleetId: string) => void;
  onToggleVehicle: (vehicleId: string) => void;
};

export function LiveSidebar({
  sidebar,
  isCollapsed,
  onToggleCollapsed,
  onSearchChange,
  onStatusChange,
  onProviderChange,
  onToggleExpanded,
  onToggleFleet,
  onToggleVehicle,
}: LiveSidebarProps) {
  if (isCollapsed) {
    return (
      <aside className="flex shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-2">
        <CollapseToggle
          label={EXPAND_SIDEBAR_LABEL}
          direction="right"
          expanded={false}
          onClick={onToggleCollapsed}
        />
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <LiveSidebarFilters
        searchTerm={sidebar.search.term}
        status={sidebar.filters.status}
        provider={sidebar.filters.provider}
        availableProviders={sidebar.filters.availableProviders}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onProviderChange={onProviderChange}
        collapseToggle={
          <CollapseToggle
            label={COLLAPSE_SIDEBAR_LABEL}
            direction="left"
            expanded
            onClick={onToggleCollapsed}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {sidebar.fleets.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] leading-relaxed text-slate-600">
            {EMPTY_FLEETS_LABEL}
          </p>
        ) : (
          <ul>
            {sidebar.fleets.map((fleet) => (
              <LiveFleetNode
                key={fleet.fleetId}
                fleet={fleet}
                isNarrowed={sidebar.filters.isNarrowed}
                onToggleExpanded={onToggleExpanded}
                onToggleFleet={onToggleFleet}
                onToggleVehicle={onToggleVehicle}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
