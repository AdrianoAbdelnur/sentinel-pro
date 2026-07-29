import type { LiveStatusFilter } from "@/application/live";

import { LiveProviderFilter } from "./live-provider-filter";
import { LiveStatusFilterChips } from "./live-status-filter-chips";

const SEARCH_PLACEHOLDER = "Buscar patente, vehículo o flota";

type LiveSidebarFiltersProps = {
  searchTerm: string;
  status: LiveStatusFilter;
  provider?: string;
  availableProviders: string[];
  onSearchChange: (term: string) => void;
  onStatusChange: (status: LiveStatusFilter) => void;
  onProviderChange: (provider: string | undefined) => void;
  // Passed in, not built here, so this component stays unaware of the
  // sidebar's collapse state.
  collapseToggle?: React.ReactNode;
};

export function LiveSidebarFilters({
  searchTerm,
  status,
  provider,
  availableProviders,
  onSearchChange,
  onStatusChange,
  onProviderChange,
  collapseToggle,
}: LiveSidebarFiltersProps) {
  return (
    <div className="shrink-0 space-y-2 border-b border-slate-800 p-2.5">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchTerm}
            placeholder={SEARCH_PLACEHOLDER}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-900/70 py-1.5 pl-8 pr-2.5 text-[13px] text-slate-100 transition-colors placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
          />
        </div>
        {collapseToggle}
      </div>

      <LiveProviderFilter
        provider={provider}
        availableProviders={availableProviders}
        onProviderChange={onProviderChange}
      />

      <LiveStatusFilterChips status={status} onStatusChange={onStatusChange} />
    </div>
  );
}
