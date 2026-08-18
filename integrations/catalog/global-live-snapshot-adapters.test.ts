import { describe, expect, it } from "vitest";

import { mapHowenOperationalStateToCatalogSnapshots } from "./global-live-snapshot-adapters";

describe("global Live snapshot adapters", () => {
  it("maps Howen operational data by contribution without exposing provider roster ownership", () => {
    const snapshots = mapHowenOperationalStateToCatalogSnapshots(
      {
        fleets: [{ fleetId: "howen:fleet:external", label: "Provider fleet", vehicleIds: ["howen:vehicle:device-1"] }],
        liveVehicles: [{
          vehicle: { id: "howen:vehicle:device-1", fleetId: "howen:fleet:external", isActive: true },
          device: { id: "howen:device:device-1", vehicleId: "howen:vehicle:device-1", externalId: "device-1", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true },
          telemetry: { deviceId: "howen:device:device-1", online: true },
        }],
      },
      [{ id: "contribution-1", connectionId: "connection-1", externalId: "device-1", vehicleId: "canonical-vehicle", capabilities: { video: "eligible" }, presence: "present" }],
    );

    expect(snapshots).toEqual({
      "device-1": {
        device: expect.objectContaining({ vehicleId: "canonical-vehicle", externalId: "device-1" }),
        telemetry: { deviceId: "howen:device:device-1", online: true },
      },
    });
    expect(JSON.stringify(snapshots)).not.toContain("Provider fleet");
  });
});
