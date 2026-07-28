import type { DeviceTelemetry } from "./entities";

export function hasValidGps(telemetry?: DeviceTelemetry): telemetry is DeviceTelemetry &
  Required<Pick<DeviceTelemetry, "latitude" | "longitude">> {
  return (
    typeof telemetry?.latitude === "number" &&
    Number.isFinite(telemetry.latitude) &&
    typeof telemetry.longitude === "number" &&
    Number.isFinite(telemetry.longitude)
  );
}
