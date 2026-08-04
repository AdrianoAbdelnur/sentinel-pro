import { describe, expect, it } from "vitest";

import type { HowenRosterRecord } from "./responses";
import { mapHowenRoster } from "./map-howen-roster";

const record = (
  overrides: Partial<HowenRosterRecord> = {},
): HowenRosterRecord => ({
  deviceno: "technical-1",
  devicename: "AA264KK",
  fleetid: "fleet-1",
  fleetname: "Travil SAS",
  accessmode: 2,
  videoencodernumber: 4,
  ...overrides,
});

describe("mapHowenRoster", () => {
  it("preserves the verified complete-roster shape without raw payload data", () => {
    const records = Array.from({ length: 621 }, (_, index) =>
      record({
        deviceno: `device-${index}`,
        devicename: `PLATE-${index}`,
        fleetid: `fleet-${index % 119}`,
        fleetname: `Fleet ${index % 119}`,
      }),
    );

    const state = mapHowenRoster(records);

    expect(state.fleets).toHaveLength(119);
    expect(state.liveVehicles).toHaveLength(621);
    expect(
      new Set(state.liveVehicles.map(({ vehicle }) => vehicle.id)).size,
    ).toBe(621);
  });

  it("separates stable technical identity from visible text", () => {
    const state = mapHowenRoster([
      record({
        longitude: "-58.3816",
        latitude: "-34.6037",
        speed: "46",
        direct: "90",
        dtu: "2026-07-29 21:00:00",
      }),
    ]);
    const item = state.liveVehicles[0];

    expect(state.fleets[0]).toEqual({
      fleetId: "howen:fleet:fleet-1",
      label: "Travil SAS",
      vehicleIds: ["howen:vehicle:technical-1"],
    });
    expect(item.vehicle).toEqual({
      id: "howen:vehicle:technical-1",
      fleetId: "howen:fleet:fleet-1",
      plate: "AA264KK",
      isActive: true,
    });
    expect(item.vehicle).not.toHaveProperty("label");
    expect(item.device).toMatchObject({
      id: "howen:device:technical-1",
      vehicleId: "howen:vehicle:technical-1",
      provider: "HOWEN",
      externalId: "technical-1",
      origin: "howen",
      kind: "mdvr",
      channelCount: 4,
      isActive: true,
    });
    expect(item.telemetry).toEqual({
      deviceId: "howen:device:technical-1",
      online: true,
      gpsAt: "2026-07-30T00:00:00.000Z",
      latitude: -34.6037,
      longitude: -58.3816,
      speedKmH: 46,
      headingDeg: 90,
    });
  });

  it("uses one canonical visible provider value for every Howen vehicle", () => {
    const state = mapHowenRoster([
      record(),
      record({ deviceno: "technical-2", devicename: "AC946AE" }),
    ]);

    expect(
      state.liveVehicles.map(({ device }) => device?.provider),
    ).toEqual(["HOWEN", "HOWEN"]);
  });

  it("isolates records without a usable identity", () => {
    const state = mapHowenRoster([
      record({ deviceno: " " }),
      record({ deviceno: undefined }),
      record(),
    ]);

    expect(state.liveVehicles).toHaveLength(1);
    expect(state.fleets[0].vehicleIds).toEqual(["howen:vehicle:technical-1"]);
  });

  it("omits malformed optional numeric and timestamp values", () => {
    const item = mapHowenRoster([
      record({
        accessmode: "offline",
        videoencodernumber: -1,
        longitude: 181,
        latitude: -91,
        speed: -1,
        direct: 361,
        dtu: "not-a-date",
      }),
    ]).liveVehicles[0];

    expect(item.device).not.toHaveProperty("channelCount");
    expect(item.telemetry).toEqual({
      deviceId: "howen:device:technical-1",
    });
  });
});
