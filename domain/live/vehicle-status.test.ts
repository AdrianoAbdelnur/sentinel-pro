import { describe, expect, it } from "vitest";

import type { DeviceTelemetry } from "./entities";
import { DEFAULT_STALE_AFTER_MS, resolveVehicleStatus } from "./vehicle-status";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const STALE_AFTER_MS = 5 * 60 * 1000;

function telemetry(overrides: Partial<DeviceTelemetry> = {}): DeviceTelemetry {
  return {
    deviceId: "device-1",
    ...overrides,
  };
}

describe("resolveVehicleStatus", () => {
  it("returns offline when there is no telemetry record at all", () => {
    expect(
      resolveVehicleStatus({ telemetry: undefined, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("returns offline when online is explicitly false, even with a recent report and positive speed", () => {
    const record = telemetry({
      online: false,
      gpsAt: new Date(NOW - 20_000).toISOString(),
      speedKmH: 55,
    });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("returns en-route when online is true and speed is positive", () => {
    const record = telemetry({ online: true, speedKmH: 46 });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("en-route");
  });

  it("returns stopped when online is true and speed is zero", () => {
    const record = telemetry({ online: true, speedKmH: 0 });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("stopped");
  });

  it("returns stopped when online is true and speed is not reported at all", () => {
    const record = telemetry({ online: true });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("stopped");
  });

  it("returns offline when online is not true, regardless of speed", () => {
    const record = telemetry({ online: false, speedKmH: 80 });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("returns offline when online is absent and there is no report timestamp at all", () => {
    const record = telemetry({ speedKmH: 40 });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("returns offline when online is absent and gpsAt is unparsable", () => {
    const record = telemetry({ gpsAt: "not-a-date" });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("returns offline when online is absent and the last report is older than the threshold", () => {
    const record = telemetry({ gpsAt: new Date(NOW - (STALE_AFTER_MS + 1)).toISOString() });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("offline");
  });

  it("resolves online (stopped, no speed) when online is absent and the last report is exactly at the threshold boundary", () => {
    const record = telemetry({ gpsAt: new Date(NOW - STALE_AFTER_MS).toISOString() });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("stopped");
  });

  it("returns en-route when online is absent, the last report is within the threshold, and speed is positive", () => {
    const record = telemetry({
      gpsAt: new Date(NOW - 2 * 60_000).toISOString(),
      speedKmH: 12,
    });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("en-route");
  });

  it("resolves online when the report timestamp is in the future (clock skew must not invert the rule)", () => {
    const record = telemetry({ gpsAt: new Date(NOW + 60_000).toISOString(), speedKmH: 10 });

    expect(
      resolveVehicleStatus({ telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("en-route");
  });

  it("returns stopped when online and speed is negative or NaN", () => {
    const negative = telemetry({ online: true, speedKmH: -5 });
    const notANumber = telemetry({ online: true, speedKmH: Number.NaN });

    expect(
      resolveVehicleStatus({ telemetry: negative, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("stopped");
    expect(
      resolveVehicleStatus({ telemetry: notANumber, nowMs: NOW, staleAfterMs: STALE_AFTER_MS }),
    ).toBe("stopped");
  });

  it("returns the identical result for identical inputs (pure function)", () => {
    const record = telemetry({ online: true, speedKmH: 30 });
    const input = { telemetry: record, nowMs: NOW, staleAfterMs: STALE_AFTER_MS };

    expect(resolveVehicleStatus(input)).toBe(resolveVehicleStatus(input));
  });

  it("exports the default staleness threshold as 5 minutes", () => {
    expect(DEFAULT_STALE_AFTER_MS).toBe(5 * 60 * 1000);
  });
});
