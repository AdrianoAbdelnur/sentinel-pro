import { describe, expect, it } from "vitest";

import type { VehiclePlacement } from "./entities";
import { reconcileFleetPlacement, unionFleetRoster } from "./union-projection";

describe("canonical fleet union projection", () => {
  it("composes the canonical Fleet roster as the union of partially overlapping provider rosters, keeping provider-only Vehicles and deduplicating shared ones", () => {
    const cybermapaRoster = ["v1", "v2"];
    const howenRoster = ["v2", "v3"];

    const roster = unionFleetRoster([cybermapaRoster, howenRoster]);

    expect(roster).toEqual(["v1", "v2", "v3"]);
  });

  it("enriches an existing canonical Vehicle when a later provider identity reports it, without duplicating the entry", () => {
    const existingRoster = ["v1"];
    const laterRoster = ["v1", "v2"];

    const roster = unionFleetRoster([existingRoster, laterRoster]);

    expect(roster).toEqual(["v1", "v2"]);
  });

  it("retains a canonical Vehicle in the Fleet roster after a later provider report omits it", () => {
    const existingCanonicalRoster = ["v1", "v2"];
    const laterProviderRoster = ["v2"];

    const roster = unionFleetRoster([existingCanonicalRoster, laterProviderRoster]);

    expect(roster).toEqual(["v1", "v2"]);
  });

  it("resolves a single proposed real Fleet for a non-admin placement", () => {
    const current: VehiclePlacement = { fleetId: "fleet-unassigned", source: "system" };

    const outcome = reconcileFleetPlacement(current, ["fleet-real"], "fleet-unassigned");

    expect(outcome).toEqual({ kind: "resolved", placement: { fleetId: "fleet-real", source: "system" } });
  });

  it("sends a Vehicle to review instead of overwriting its placement when providers propose conflicting Fleets", () => {
    const current: VehiclePlacement = { fleetId: "fleet-unassigned", source: "system" };

    const outcome = reconcileFleetPlacement(current, ["fleet-a", "fleet-b"], "fleet-unassigned");

    expect(outcome).toEqual({ kind: "review", placement: current });
  });

  it("never reverts an administrator's placement even when providers propose conflicting Fleets", () => {
    const current: VehiclePlacement = { fleetId: "fleet-admin", source: "admin" };

    const outcome = reconcileFleetPlacement(current, ["fleet-a", "fleet-b"], "fleet-unassigned");

    expect(outcome).toEqual({ kind: "resolved", placement: current });
  });
});
