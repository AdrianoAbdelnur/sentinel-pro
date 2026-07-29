import type { VehicleStatus } from "@/application/live";

import { VEHICLE_STATUS_COPY } from "../live-copy";
import { VEHICLE_STATUS_TONE } from "./vehicle-status-tone";

type LiveVehicleStatusBadgeProps = {
  status: VehicleStatus;
};

// The word is not decorative: colour must never be the sole carrier of status.
export function LiveVehicleStatusBadge({ status }: LiveVehicleStatusBadgeProps) {
  const tone = VEHICLE_STATUS_TONE[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
      {VEHICLE_STATUS_COPY[status]}
    </span>
  );
}
