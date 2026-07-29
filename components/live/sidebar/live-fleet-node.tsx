import type { LiveFleetNode as LiveFleetNodeViewModel } from "@/application/live";

import { LiveVehicleRow } from "./live-vehicle-row";

type LiveFleetNodeProps = {
  fleet: LiveFleetNodeViewModel;
  isNarrowed: boolean;
  onToggleExpanded: (fleetId: string) => void;
  onToggleFleet: (fleetId: string) => void;
  onToggleVehicle: (vehicleId: string) => void;
};

export function LiveFleetNode({
  fleet,
  isNarrowed,
  onToggleExpanded,
  onToggleFleet,
  onToggleVehicle,
}: LiveFleetNodeProps) {
  const { online, total } = fleet.counts;
  const countsLabel = `${online} de ${total} vehículos en línea`;
  const visibleCount = fleet.vehicles.length;

  return (
    <li className="border-b border-slate-800/60 last:border-b-0">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-l-2 border-l-slate-700 bg-slate-950/90 px-2.5 py-2 backdrop-blur-sm">
        <input
          type="checkbox"
          aria-label={`Seleccionar todos los vehículos de ${fleet.label}`}
          checked={fleet.isSelected}
          onChange={() => onToggleFleet(fleet.fleetId)}
          className="size-3.5 shrink-0 appearance-none rounded-sm border border-slate-600 bg-transparent transition-colors checked:border-sky-400 checked:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        />

        <button
          type="button"
          onClick={() => onToggleExpanded(fleet.fleetId)}
          aria-expanded={fleet.isExpanded}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          <svg
            aria-hidden
            viewBox="0 0 8 8"
            className={`size-2 shrink-0 fill-slate-500 transition-transform duration-150 ${
              fleet.isExpanded ? "rotate-90" : ""
            }`}
          >
            <path d="M2 0 L7 4 L2 8 Z" />
          </svg>
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {fleet.label}
          </span>
        </button>

        <span
          aria-label={countsLabel}
          className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400"
        >
          <span className={online === 0 ? "text-rose-400" : "text-teal-300"}>
            {online}
          </span>
          <span className="text-slate-600">/{total}</span>
        </span>
      </div>

      {isNarrowed && (
        <p className="px-2.5 pt-1 font-mono text-[10px] tabular-nums text-slate-600">
          {visibleCount} {pluralizeVisible(visibleCount)}
        </p>
      )}

      {fleet.isExpanded && (
        <ul className="pb-1">
          {fleet.vehicles.map((vehicle) => (
            <LiveVehicleRow
              key={vehicle.vehicleId}
              vehicle={vehicle}
              onToggle={onToggleVehicle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function pluralizeVisible(count: number): string {
  return count === 1 ? "visible" : "visibles";
}
