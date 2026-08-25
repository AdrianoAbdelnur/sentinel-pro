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
  onFleetPageChange?: (fleetId: string, page: number) => void;
  pagination?: { page: number; totalPages: number };
  onPageChange?: (page: number) => void;
  loadingFleetIds?: readonly string[];
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
  onFleetPageChange,
  pagination,
  onPageChange,
  loadingFleetIds = [],
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
                isLoading={loadingFleetIds.includes(fleet.fleetId)}
                onToggleExpanded={onToggleExpanded}
                onToggleFleet={onToggleFleet}
                onToggleVehicle={onToggleVehicle}
                onPageChange={onFleetPageChange}
              />
            ))}
          </ul>
        )}
      </div>

      {pagination && onPageChange && (
        <nav
          aria-label="Paginación de vehículos"
          className="flex shrink-0 flex-col gap-1.5 border-t border-slate-800 bg-slate-950 px-2.5 py-2 font-mono text-[10px] text-slate-500"
        >
          <div className="flex items-center justify-center gap-1">
            <PageButton
              label="Retroceder 10 páginas"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(Math.max(1, pagination.page - 10))}
            >
              «
            </PageButton>
            <PageButton
              label="Página anterior"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              ‹
            </PageButton>
            {getVisiblePages(pagination.page, pagination.totalPages).map((page) => (
              <button
                key={page}
                type="button"
                aria-label={`Ir a la página ${page}`}
                aria-current={page === pagination.page ? "page" : undefined}
                onClick={() => onPageChange(page)}
                className={`flex size-6 items-center justify-center rounded tabular-nums transition-colors ${
                  page === pagination.page
                    ? "bg-sky-400/20 text-sky-200 ring-1 ring-inset ring-sky-400/50"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {page}
              </button>
            ))}
            <PageButton
              label="Página siguiente"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              ›
            </PageButton>
            <PageButton
              label="Avanzar 10 páginas"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 10))}
            >
              »
            </PageButton>
          </div>
          <span className="text-center tabular-nums text-slate-400">
            {pagination.page} <span className="text-slate-600">de</span> {pagination.totalPages}
          </span>
        </nav>
      )}
    </aside>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded border border-slate-800 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:pointer-events-none disabled:opacity-30"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

function getVisiblePages(page: number, totalPages: number): number[] {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index);
}
