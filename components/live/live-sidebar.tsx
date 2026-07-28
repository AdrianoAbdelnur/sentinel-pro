import type { LiveSidebarViewModel } from "@/application/live";

import { LiveFleetNode } from "./live-fleet-node";

type LiveSidebarProps = {
  sidebar: LiveSidebarViewModel;
  onSearchChange: (term: string) => void;
  onFilterChange: (onlyActiveOrOnline: boolean) => void;
  onToggleExpanded: (fleetId: string) => void;
  onToggleFleet: (fleetId: string) => void;
  onToggleVehicle: (vehicleId: string) => void;
};

export function LiveSidebar({
  sidebar,
  onSearchChange,
  onFilterChange,
  onToggleExpanded,
  onToggleFleet,
  onToggleVehicle,
}: LiveSidebarProps) {
  return (
    <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="shrink-0 space-y-3 border-b border-zinc-800 p-3">
        <input
          type="search"
          value={sidebar.search.term}
          placeholder={sidebar.search.placeholder}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={sidebar.filters.onlyActiveOrOnline}
            onChange={(event) => onFilterChange(event.target.checked)}
            className="size-3.5 accent-emerald-500"
          />
          Only active or online
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2">
        {sidebar.fleets.length === 0 ? (
          <p className="px-3 py-4 text-sm text-zinc-500">No fleets match.</p>
        ) : (
          <ul>
            {sidebar.fleets.map((fleet) => (
              <LiveFleetNode
                key={fleet.fleetId}
                fleet={fleet}
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
