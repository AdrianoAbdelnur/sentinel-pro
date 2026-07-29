import type { DeviceTelemetry } from "./entities";

export type VehicleStatus = "en-route" | "stopped" | "offline";

export const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

export type ResolveVehicleStatusInput = {
  telemetry?: DeviceTelemetry;
  nowMs: number;
  staleAfterMs: number;
};

function resolveOnline(telemetry: DeviceTelemetry | undefined, nowMs: number, staleAfterMs: number): boolean {
  if (telemetry?.online === true) {
    return true;
  }

  if (telemetry?.online === false) {
    return false;
  }

  const gpsAt = telemetry?.gpsAt;
  if (!gpsAt) {
    return false;
  }

  const gpsAtMs = Date.parse(gpsAt);
  if (Number.isNaN(gpsAtMs)) {
    return false;
  }

  return nowMs - gpsAtMs <= staleAfterMs;
}

export function resolveVehicleStatus(input: ResolveVehicleStatusInput): VehicleStatus {
  const { telemetry, nowMs, staleAfterMs } = input;

  if (!resolveOnline(telemetry, nowMs, staleAfterMs)) {
    return "offline";
  }

  const speedKmH = telemetry?.speedKmH;
  if (typeof speedKmH === "number" && Number.isFinite(speedKmH) && speedKmH > 0) {
    return "en-route";
  }

  return "stopped";
}
