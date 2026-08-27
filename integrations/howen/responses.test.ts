import { describe, expect, it } from "vitest";

import fleetFixture from "./fixtures/fleet-find-all.sanitized.json";
import { resolveHowenFleetCompany } from "./fleet";
import { parseHowenFleetResponse, parseHowenRosterResponse } from "./responses";

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

describe("parseHowenFleetResponse", () => {
  it("preserves the verified Fleet label and ancestry fields from the sanitized contract fixture", () => {
    const fleets = parseHowenFleetResponse(fleetFixture);
    expect(fleets).toEqual([
      { guid: "fleet-root-001", parentid: "", contacts: "Example Logistics", fleetname: "Example Root Fleet" },
      { guid: "fleet-child-001", parentid: "fleet-root-001", contacts: "", fleetname: "Example SubFleet" },
    ]);
    expect(resolveHowenFleetCompany(fleets, "fleet-child-001")).toEqual({ directFleetId: "fleet-child-001", companySourceFleetId: "fleet-root-001", company: "Example Logistics", outcome: "ancestor" });
  });
});
