import { describe, expect, it } from "vitest";

import type {
  LiveState,
  OperationalSource,
  OperationalSourceResult,
} from "./contracts";
import { aggregateOperationalSources } from "./aggregate-operational-sources";

function state(prefix: string): LiveState {
  const fleetId = `${prefix}:fleet`;
  const vehicleId = `${prefix}:vehicle`;

  return {
    fleets: [{ fleetId, label: `${prefix} fleet`, vehicleIds: [vehicleId] }],
    liveVehicles: [
      {
        vehicle: { id: vehicleId, fleetId, plate: `${prefix}-plate`, isActive: true },
        device: {
          id: `${prefix}:device`,
          vehicleId,
          provider: prefix,
          origin: "other",
          kind: "other",
          isActive: true,
        },
      },
    ],
  };
}
function source(
  id: string,
  result: OperationalSourceResult | (() => Promise<OperationalSourceResult>),
): OperationalSource {
  return {
    identity: { id, label: `${id} connection` },
    loadSnapshot: typeof result === "function" ? result : async () => result,
  };
}
function warning(sourceId: string) {
  return {
    code: "source-unavailable" as const,
    sourceId,
    sourceLabel: `${sourceId} connection`,
  };
}

describe("aggregateOperationalSources", () => {
  it("merges successful states in configured order", async () => {
    const alpha = state("alpha");
    const beta = state("beta");
    const { state: merged, warnings } = await aggregateOperationalSources([
      source("alpha", { kind: "success", state: alpha }),
      source("beta", { kind: "success", state: beta }),
    ]);
    expect(merged.fleets).toEqual([...alpha.fleets, ...beta.fleets]);
    expect(merged.liveVehicles).toEqual([
      ...alpha.liveVehicles,
      ...beta.liveVehicles,
    ]);
    expect(warnings).toEqual([]);
  });

  it("loads independently while retaining configured order", async () => {
    let resolveAlpha: (result: OperationalSourceResult) => void = () => {};
    const alpha = state("alpha");
    const beta = state("beta");
    const pending = aggregateOperationalSources([
      source("alpha", () => new Promise((resolve) => (resolveAlpha = resolve))),
      source("beta", { kind: "success", state: beta }),
    ]);

    await Promise.resolve();
    resolveAlpha({ kind: "success", state: alpha });
    expect((await pending).state.fleets.map(({ fleetId }) => fleetId)).toEqual([
      "alpha:fleet",
      "beta:fleet",
    ]);
  });

  it("preserves successes and translates returned or thrown failures", async () => {
    const beta = state("beta");
    const result = await aggregateOperationalSources([
      source("alpha", { kind: "failure", code: "unavailable" }),
      source("beta", { kind: "success", state: beta }),
      source("gamma", async () => {
        throw new Error("raw provider failure");
      }),
    ]);

    expect(result).toEqual({
      state: beta,
      warnings: [warning("alpha"), warning("gamma")],
    });
  });

  it("returns no fixture data and one warning per source when all fail", async () => {
    const result = await aggregateOperationalSources([
      source("alpha", { kind: "failure", code: "unavailable" }),
      source("beta", { kind: "failure", code: "unavailable" }),
    ]);

    expect(result).toEqual({
      state: { fleets: [], liveVehicles: [] },
      warnings: [warning("alpha"), warning("beta")],
    });
  });

  it.each(["fleet", "vehicle", "device"] as const)(
    "rejects a source atomically when its %s ID collides with accepted state",
    async (identityKind) => {
      const alpha = state("alpha");
      const beta = state("beta");

      if (identityKind === "fleet") {
        beta.fleets[0].fleetId = "alpha:fleet";
      } else if (identityKind === "vehicle") {
        beta.liveVehicles[0].vehicle.id = "alpha:vehicle";
      } else {
        beta.liveVehicles[0].device!.id = "alpha:device";
      }
      beta.fleets.push({
        fleetId: "beta:unique-fleet",
        label: "must not leak",
        vehicleIds: [],
      });
      const result = await aggregateOperationalSources([
        source("alpha", { kind: "success", state: alpha }),
        source("beta", { kind: "success", state: beta }),
      ]);
      expect(result).toEqual({
        state: alpha,
        warnings: [warning("beta")],
      });
    },
  );

  it.each(["fleet", "vehicle", "device"] as const)(
    "rejects duplicate %s IDs inside one candidate source",
    async (identityKind) => {
      const duplicate = state("alpha");

      if (identityKind === "fleet") {
        duplicate.fleets.push(structuredClone(duplicate.fleets[0]));
      } else {
        const second = structuredClone(duplicate.liveVehicles[0]);
        second.vehicle.id = identityKind === "vehicle"
          ? "alpha:vehicle"
          : "alpha:vehicle-2";
        second.device!.id = identityKind === "device"
          ? "alpha:device"
          : "alpha:device-2";
        duplicate.liveVehicles.push(second);
      }
      expect(
        await aggregateOperationalSources([
          source("alpha", { kind: "success", state: duplicate }),
        ]),
      ).toEqual({
        state: { fleets: [], liveVehicles: [] },
        warnings: [warning("alpha")],
      });
    },
  );
});
