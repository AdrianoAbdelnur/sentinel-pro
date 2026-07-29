import type { LiveStatusFilter, VehicleStatus } from "@/application/live";

import { VEHICLE_STATUS_COPY } from "../live-copy";
import { VEHICLE_STATUS_TONE } from "./vehicle-status-tone";

export const ALL_STATUS_LABEL = "Todos";

const STATUSES: VehicleStatus[] = ["en-route", "stopped", "offline"];

const CHIP_BASE =
  "rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60";
const CHIP_INACTIVE =
  "bg-transparent text-slate-500 ring-slate-700/70 hover:text-slate-300 hover:ring-slate-600";
const ALL_CHIP_ACTIVE = "bg-sky-400/15 text-sky-200 ring-sky-400/40";

type LiveStatusFilterChipsProps = {
  status: LiveStatusFilter;
  onStatusChange: (status: LiveStatusFilter) => void;
};

export function LiveStatusFilterChips({
  status,
  onStatusChange,
}: LiveStatusFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        aria-pressed={status === "all"}
        onClick={() => onStatusChange("all")}
        className={`${CHIP_BASE} ${status === "all" ? ALL_CHIP_ACTIVE : CHIP_INACTIVE}`}
      >
        {ALL_STATUS_LABEL}
      </button>

      {STATUSES.map((vehicleStatus) => {
        const isActive = status === vehicleStatus;

        return (
          <button
            key={vehicleStatus}
            type="button"
            aria-pressed={isActive}
            onClick={() => onStatusChange(vehicleStatus)}
            className={`${CHIP_BASE} ${
              isActive ? VEHICLE_STATUS_TONE[vehicleStatus].chipActive : CHIP_INACTIVE
            }`}
          >
            {VEHICLE_STATUS_COPY[vehicleStatus]}
          </button>
        );
      })}
    </div>
  );
}
