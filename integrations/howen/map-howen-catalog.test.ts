import { describe, expect, it } from "vitest";

import { mapHowenCatalog } from "./map-howen-catalog";
import type { HowenRosterRecord } from "./responses";

function record(overrides: Partial<HowenRosterRecord> = {}): HowenRosterRecord {
  return {
    deviceno: "device-1",
    devicename: "AA264KK",
    fleetid: "fleet-1",
    fleetname: "Travil SAS",
    ...overrides,
  };
}

describe("mapHowenCatalog", () => {
  it("translates a valid record into a Company-scoped, fleet-carrying candidate, mapping devicename to the display label only", () => {
    const candidates = mapHowenCatalog([record()], "company-acme");

    expect(candidates).toEqual([
      {
        externalId: "device-1",
        companyId: "company-acme",
        externalFleetId: "fleet-1",
        fleetLabel: "Travil SAS",
        label: "AA264KK",
      },
    ]);
  });

  it("never derives a plate from devicename, even when it looks like one, because the spec authorizes it only as a headline", () => {
    const candidates = mapHowenCatalog([record({ devicename: "AB123CD" })], "company-acme");

    expect(candidates[0]).not.toHaveProperty("registeredPlate");
  });

  it.each([
    ["deviceno", { deviceno: undefined }],
    ["devicename", { devicename: undefined }],
    ["fleetid", { fleetid: undefined }],
    ["fleetname", { fleetname: undefined }],
  ])("rejects a record missing required identity %s, without inventing a value", (_field, overrides) => {
    const candidates = mapHowenCatalog([record(overrides)], "company-acme");

    expect(candidates).toEqual([]);
  });

  it("continues processing valid records after rejecting an invalid one", () => {
    const candidates = mapHowenCatalog([record({ deviceno: undefined }), record({ deviceno: "device-2" })], "company-acme");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.externalId).toBe("device-2");
  });

  it("deduplicates repeated deviceno values into a single candidate, keeping the first occurrence", () => {
    const candidates = mapHowenCatalog([record(), record({ devicename: "ZZ999ZZ" })], "company-acme");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe("AA264KK");
  });

  it("stamps every candidate with the connection's already-bound companyId, never a per-record value", () => {
    const candidates = mapHowenCatalog([record({ deviceno: "device-1" }), record({ deviceno: "device-2" })], "company-fleet-co");

    expect(candidates.every((candidate) => candidate.companyId === "company-fleet-co")).toBe(true);
  });
});
