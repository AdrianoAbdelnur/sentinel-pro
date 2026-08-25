import { describe, expect, it, vi } from "vitest";

import { createLoadLivePage } from "./load-live-page";

describe("loadLivePage", () => {
  it("loads only the requested global page and passes its plates to snapshots", async () => {
    const loadSnapshots = vi.fn().mockResolvedValue({});
    const dependencies = {
      groups: { listForOrganization: vi.fn().mockResolvedValue([{ id: "group-1", label: "North", vehicleCount: 60 }]) },
      vehicles: { countByOrganizationAndGroup: vi.fn().mockResolvedValue({ "group-1": 60 }), listByOrganizationAndGroupRanges: vi.fn().mockResolvedValue([{ id: "vehicle-1", placementFleetId: "group-1", plate: "AAA111", normalizedPlate: "AAA111" }]) },
      contributions: { listByVehicleId: vi.fn().mockResolvedValue([]) },
      connections: { findById: vi.fn() },
      providers: { findById: vi.fn() },
      policies: { list: vi.fn().mockResolvedValue([]) },
      loadSnapshots,
    };

    const result = await createLoadLivePage(dependencies)({ organizationId: "org-1", page: 2, plate: "AAA" });

    expect(result.kind).toBe("success");
    expect(dependencies.vehicles.countByOrganizationAndGroup).toHaveBeenCalledWith("org-1", ["group-1"], "AAA");
    expect(dependencies.vehicles.listByOrganizationAndGroupRanges).toHaveBeenCalledWith("org-1", [{ groupId: "group-1", skip: 50, limit: 10 }], "AAA");
    expect(loadSnapshots).toHaveBeenCalledWith([], [], [], new Map([["vehicle-1", "AAA111"]]));
    expect(result.kind === "success" && result.state.pagination).toEqual({ page: 2, pageSize: 50, totalItems: 60, totalPages: 2, plate: "AAA" });
  });

  it("keeps groups together when the next group would exceed 50 vehicles", async () => {
    const dependencies = {
      groups: { listForOrganization: vi.fn().mockResolvedValue([{ id: "group-1", label: "North", vehicleCount: 40 }, { id: "group-2", label: "South", vehicleCount: 30 }]) },
      vehicles: { countByOrganizationAndGroup: vi.fn().mockResolvedValue({ "group-1": 40, "group-2": 30 }), listByOrganizationAndGroupRanges: vi.fn().mockResolvedValue([]) },
      contributions: { listByVehicleId: vi.fn().mockResolvedValue([]) },
      connections: { findById: vi.fn() },
      providers: { findById: vi.fn() },
      policies: { list: vi.fn().mockResolvedValue([]) },
      loadSnapshots: vi.fn().mockResolvedValue({}),
    };

    await createLoadLivePage(dependencies)({ organizationId: "org-1", page: 1 });
    expect(dependencies.vehicles.listByOrganizationAndGroupRanges).toHaveBeenCalledWith("org-1", [{ groupId: "group-1", skip: 0, limit: 40 }], undefined);
  });

  it("treats a group search as a group filter instead of a plate filter", async () => {
    const dependencies = {
      groups: { listForOrganization: vi.fn().mockResolvedValue([{ id: "group-uro", label: "U.R.O" }, { id: "group-other", label: "Other" }]) },
      vehicles: { countByOrganizationAndGroup: vi.fn().mockResolvedValue({ "group-uro": 23 }), listByOrganizationAndGroupRanges: vi.fn().mockResolvedValue([]) },
      contributions: { listByVehicleId: vi.fn().mockResolvedValue([]) },
      connections: { findById: vi.fn() },
      providers: { findById: vi.fn() },
      policies: { list: vi.fn().mockResolvedValue([]) },
      loadSnapshots: vi.fn().mockResolvedValue({}),
    };

    await createLoadLivePage(dependencies)({ organizationId: "org-1", page: 1, plate: "U.R.O" });

    expect(dependencies.vehicles.countByOrganizationAndGroup).toHaveBeenCalledWith("org-1", ["group-uro"], undefined);
    expect(dependencies.vehicles.listByOrganizationAndGroupRanges).toHaveBeenCalledWith("org-1", [{ groupId: "group-uro", skip: 0, limit: 23 }], undefined);
  });

  it("normalizes a page beyond the available range to the last page", async () => {
    const dependencies = {
      groups: { listForOrganization: vi.fn().mockResolvedValue([{ id: "group-1", label: "North" }]) },
      vehicles: {
        countByOrganizationAndGroup: vi.fn().mockResolvedValue({ "group-1": 60 }),
        listByOrganizationAndGroupRanges: vi.fn().mockResolvedValue([]),
      },
      contributions: { listByVehicleId: vi.fn().mockResolvedValue([]) },
      connections: { findById: vi.fn() },
      providers: { findById: vi.fn() },
      policies: { list: vi.fn().mockResolvedValue([]) },
      loadSnapshots: vi.fn().mockResolvedValue({}),
    };

    const result = await createLoadLivePage(dependencies)({ organizationId: "org-1", page: 999 });

    expect(dependencies.vehicles.listByOrganizationAndGroupRanges).toHaveBeenCalledWith("org-1", [{ groupId: "group-1", skip: 50, limit: 10 }], undefined);
    expect(result.kind === "success" && result.state.pagination).toMatchObject({ page: 2, totalPages: 2 });
  });
});
