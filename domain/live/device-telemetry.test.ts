import { describe, expect, it } from "vitest";

import type { DeviceTelemetry } from "./entities";
import { hasValidGps } from "./device-telemetry";

describe("hasValidGps", () => {
  it("returns true when telemetry has finite latitude and longitude", () => {
    const telemetry: DeviceTelemetry = {
      deviceId: "device-1",
      online: true,
      latitude: -34.6037,
      longitude: -58.3816,
    };

    expect(hasValidGps(telemetry)).toBe(true);
  });

  it("returns false when coordinates are missing or invalid", () => {
    const missingLatitude: DeviceTelemetry = {
      deviceId: "device-1",
      online: true,
      longitude: -58.3816,
    };

    const invalidLongitude: DeviceTelemetry = {
      deviceId: "device-2",
      online: true,
      latitude: -34.6037,
      longitude: Number.NaN,
    };

    expect(hasValidGps(missingLatitude)).toBe(false);
    expect(hasValidGps(invalidLongitude)).toBe(false);
  });
});
