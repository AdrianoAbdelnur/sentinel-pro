import { describe, expect, it } from "vitest";

import {
  belongsToOrganization,
  createUnassignedFleet,
  reconcilePlacement,
  resolvePlacement,
  UNASSIGNED_FLEET_NAME,
  type Company,
} from "./index";

describe("catalog domain rules", () => {
  it("creates a system-managed Unassigned fleet for a company", () => {
    const fleet = createUnassignedFleet("fleet-1", "company-1");

    expect(fleet).toEqual({ id: "fleet-1", companyId: "company-1", name: UNASSIGNED_FLEET_NAME, kind: "unassigned" });
  });

  it("scopes company ownership to its identity organization tenant", () => {
    const company: Company = { id: "company-1", organizationId: "org-a", name: "Acme" };

    expect(belongsToOrganization(company, "org-a")).toBe(true);
    expect(belongsToOrganization(company, "org-b")).toBe(false);
  });

  it("places an unmatched candidate into the Unassigned fleet", () => {
    expect(resolvePlacement({}, "fleet-unassigned")).toEqual({ fleetId: "fleet-unassigned", source: "system" });
  });

  it("places a matched candidate into its matched fleet", () => {
    expect(resolvePlacement({ matchedFleetId: "fleet-real" }, "fleet-unassigned")).toEqual({
      fleetId: "fleet-real",
      source: "system",
    });
  });

  it("keeps an administrator's placement across reconciliation regardless of the new candidate", () => {
    const current = { fleetId: "fleet-admin", source: "admin" as const };

    expect(reconcilePlacement(current, { matchedFleetId: "fleet-real" }, "fleet-unassigned")).toEqual(current);
    expect(reconcilePlacement(current, {}, "fleet-unassigned")).toEqual(current);
  });

  it("re-resolves a system placement on reconciliation when no administrator override exists", () => {
    const current = { fleetId: "fleet-unassigned", source: "system" as const };

    expect(reconcilePlacement(current, { matchedFleetId: "fleet-real" }, "fleet-unassigned")).toEqual({
      fleetId: "fleet-real",
      source: "system",
    });
  });
});
