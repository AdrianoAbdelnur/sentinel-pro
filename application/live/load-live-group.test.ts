import { describe, expect, it, vi } from "vitest";

import { createLoadLiveGroup } from "./load-live-group";

describe("loadLiveGroup", () => {
  it("loads one authorized group and projects its operational snapshots", async () => {
    const loadSnapshots = vi.fn().mockResolvedValue({
      "connection-cybermapa": {
        "external-1": { telemetry: { deviceId: "gps-1", latitude: -34.6, longitude: -58.4 } },
      },
    });
    const dependencies = {
      groups: { findById: vi.fn().mockResolvedValue({ id: "group-1", label: "North" }) },
      vehicles: { listByOrganizationAndGroupId: vi.fn().mockResolvedValue([{ id: "vehicle-1", placementFleetId: "group-1", plate: "AAA111", normalizedPlate: "AAA111" }]) },
      contributions: { listByVehicleId: vi.fn().mockResolvedValue([{ id: "contribution-1", connectionId: "connection-cybermapa", externalId: "external-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" }]) },
      connections: { findById: vi.fn().mockResolvedValue({ id: "connection-cybermapa", providerId: "cybermapa", credentialRef: "ref", enabled: true, cadenceMinutes: 1 }) },
      providers: { findById: vi.fn().mockResolvedValue({ id: "cybermapa", adapterKey: "cybermapa", label: "Cybermapa" }) },
      policies: { list: vi.fn().mockResolvedValue([]) },
      loadSnapshots,
    };

    await expect(createLoadLiveGroup(dependencies)({ organizationId: "org-1", groupId: "group-1" })).resolves.toEqual({
      kind: "success",
      state: {
        fleets: [{ fleetId: "group-1", label: "North", vehicleIds: ["vehicle-1"], vehicleCount: 1, isLoaded: true }],
        liveVehicles: [{
          vehicle: { id: "vehicle-1", fleetId: "group-1", plate: "AAA111", isActive: true },
          device: undefined,
          telemetry: { deviceId: "gps-1", latitude: -34.6, longitude: -58.4 },
          operationalAlerts: { kind: "unavailable" },
          videoAlerts: { kind: "unavailable" },
        }],
      },
    });
    expect(loadSnapshots).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "connection-cybermapa" })],
      [expect.objectContaining({ id: "cybermapa" })],
      [expect.objectContaining({ vehicleId: "vehicle-1" })],
      new Map([["vehicle-1", "AAA111"]]),
    );
  });

  it("returns not found without loading the group data", async () => {
    const listVehicles = vi.fn();
    const loadSnapshots = vi.fn();
    const result = await createLoadLiveGroup({
      groups: { findById: vi.fn().mockResolvedValue(undefined) },
      vehicles: { listByOrganizationAndGroupId: listVehicles },
      contributions: { listByVehicleId: vi.fn() },
      connections: { findById: vi.fn() },
      providers: { findById: vi.fn() },
      policies: { list: vi.fn() },
      loadSnapshots,
    })({ organizationId: "org-1", groupId: "missing" });

    expect(result).toEqual({ kind: "not-found" });
    expect(listVehicles).not.toHaveBeenCalled();
    expect(loadSnapshots).not.toHaveBeenCalled();
  });
});
