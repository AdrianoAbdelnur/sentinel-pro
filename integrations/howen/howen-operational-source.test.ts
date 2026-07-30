import { describe, expect, it, vi } from "vitest";

import { createHowenOperationalSource } from "./howen-operational-source";

describe("createHowenOperationalSource", () => {
  it("maps a successful roster behind the provider-neutral source contract", async () => {
    const client = {
      fetchRoster: vi.fn().mockResolvedValue([
        {
          deviceno: "device-1",
          devicename: "AA264KK",
          fleetid: "fleet-1",
          fleetname: "Travil SAS",
          accessmode: 4,
        },
      ]),
    };
    const source = createHowenOperationalSource({ client });

    await expect(source.loadSnapshot()).resolves.toEqual({
      kind: "success",
      state: {
        fleets: [
          {
            fleetId: "howen:fleet:fleet-1",
            label: "Travil SAS",
            vehicleIds: ["howen:vehicle:device-1"],
          },
        ],
        liveVehicles: [
          expect.objectContaining({
            vehicle: expect.objectContaining({ plate: "AA264KK" }),
          }),
        ],
      },
    });
    expect(source.identity).toEqual({ id: "howen", label: "HOWEN" });
  });

  it("returns one stable failure without exposing provider details", async () => {
    const client = {
      fetchRoster: vi
        .fn()
        .mockRejectedValue(
          new Error("raw-secret JSESSIONID=session status=10003"),
        ),
    };
    const source = createHowenOperationalSource({
      client,
      identity: { id: "howen-primary", label: "Howen Principal" },
    });

    const result = await source.loadSnapshot();

    expect(result).toEqual({ kind: "failure", code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("raw-secret");
    expect(JSON.stringify(result)).not.toContain("10003");
  });
});
