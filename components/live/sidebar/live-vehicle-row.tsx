import type { LiveVehicleNode } from "@/application/live";

import { formatLastReportTime, formatLastReportTitle } from "./format-last-report";
import { LiveProviderBadge } from "./live-provider-badge";
import { LiveVehicleStatusBadge } from "./live-vehicle-status-badge";
import { VEHICLE_STATUS_TONE } from "./vehicle-status-tone";

const MISSING_VALUE = "—";

type LiveVehicleRowProps = {
  vehicle: LiveVehicleNode;
  onToggle: (vehicleId: string) => void;
};

export function LiveVehicleRow({ vehicle, onToggle }: LiveVehicleRowProps) {
  const tone = VEHICLE_STATUS_TONE[vehicle.status];
  const headline = vehicle.label ?? vehicle.plate ?? MISSING_VALUE;
  const showSecondaryPlate = Boolean(vehicle.label && vehicle.plate);
  const checkboxName = vehicle.label && vehicle.plate
    ? `${vehicle.label} · ${vehicle.plate}`
    : headline;

  return (
    <li className="group relative">
      <span
        aria-hidden
        className={`absolute inset-y-1 left-0 w-0.5 rounded-full ${tone.rail}`}
      />

      <label className="flex cursor-pointer items-start gap-2.5 py-2 pl-3 pr-2 transition-colors hover:bg-white/[0.03] has-[:checked]:bg-white/[0.05]">
        <input
          type="checkbox"
          aria-label={checkboxName}
          checked={vehicle.isSelected}
          onChange={() => onToggle(vehicle.vehicleId)}
          className="mt-0.5 size-3.5 shrink-0 appearance-none rounded-sm border border-slate-600 bg-transparent transition-colors checked:border-sky-400 checked:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-100">
              {headline}
            </span>
            <span className="ml-auto shrink-0">
              <LiveVehicleStatusBadge status={vehicle.status} />
            </span>
          </span>

          <span className="mt-0.5 flex items-baseline gap-1.5 text-[11px]">
            {showSecondaryPlate && (
              <span className="truncate font-mono text-[10px] text-slate-500">
                {vehicle.plate}
              </span>
            )}
            <span className={`shrink-0 font-mono tabular-nums ${tone.speed}`}>
              {formatSpeed(vehicle.speedKmH)}
            </span>
            <span aria-hidden className="shrink-0 text-slate-700">
              ·
            </span>
            <span className="shrink-0 font-mono tabular-nums text-slate-500">
              {vehicle.lastReportAt ? (
                <time
                  dateTime={vehicle.lastReportAt}
                  title={formatLastReportTitle(vehicle.lastReportAt)}
                >
                  {formatLastReportTime(vehicle.lastReportAt)}
                </time>
              ) : (
                MISSING_VALUE
              )}
            </span>
            <span className="ml-auto shrink-0">
              <LiveProviderBadge provider={vehicle.provider} />
            </span>
          </span>
        </span>
      </label>
    </li>
  );
}

function formatSpeed(speedKmH?: number): string {
  return speedKmH === undefined ? MISSING_VALUE : `${speedKmH} km/h`;
}
