import { describe, expect, it } from "vitest";

import { parseHowenRosterResponse } from "./responses";

describe("parseHowenRosterResponse", () => {
  it("keeps only verified roster fields from a successful envelope", () => {
    const records = parseHowenRosterResponse({
      status: 10000,
      data: {
        dataList: [
          {
            deviceno: "device-1",
            devicename: "AA264KK",
            fleetid: "fleet-1",
            fleetname: "Travil SAS",
            accessmode: 2,
            videoencodernumber: 4,
            longitude: "-58.3816",
            latitude: -34.6037,
            speed: "46",
            direct: 90,
            dtu: "2026-07-29 21:00:00",
            password: "must-not-cross-the-boundary",
          },
        ],
      },
    });

    expect(records[0]).toEqual({
      deviceno: "device-1",
      devicename: "AA264KK",
      fleetid: "fleet-1",
      fleetname: "Travil SAS",
      accessmode: 2,
      videoencodernumber: 4,
      longitude: "-58.3816",
      latitude: -34.6037,
      speed: "46",
      direct: 90,
      dtu: "2026-07-29 21:00:00",
    });
  });

  it.each([
    null,
    { status: 10003, data: null },
    { status: 10000, data: null },
    { status: 10000, data: { dataList: null } },
  ])("rejects an invalid roster envelope", (value) => {
    expect(() => parseHowenRosterResponse(value)).toThrow(
      "Invalid Howen roster response",
    );
  });

  it("isolates non-object records and malformed optional fields", () => {
    const records = parseHowenRosterResponse({
      status: 10000,
      data: {
        dataList: [
          null,
          {
            deviceno: "device-1",
            devicename: "AA264KK",
            fleetid: "fleet-1",
            fleetname: "Travil SAS",
            speed: {},
          },
        ],
      },
    });

    expect(records).toEqual([
      {
        deviceno: "device-1",
        devicename: "AA264KK",
        fleetid: "fleet-1",
        fleetname: "Travil SAS",
      },
    ]);
  });
});
