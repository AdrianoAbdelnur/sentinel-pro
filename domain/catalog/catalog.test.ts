import { describe, expect, it } from "vitest";

import {
  belongsToOrganization,
  bindCandidateToCompany,
  createUnassignedFleet,
  normalizeCompanyLabel,
  reconcilePlacement,
  resolvePlacement,
  stageCandidate,
  UNASSIGNED_FLEET_NAME,
  type Company,
  type ProviderConnection,
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

  it("keeps a real-Fleet system-sourced placement when a later source supplies no fleet opinion, instead of resetting it to Unassigned", () => {
    const current = { fleetId: "fleet-real", source: "system" as const };

    expect(reconcilePlacement(current, {}, "fleet-unassigned")).toEqual(current);
  });

  it("still re-resolves a real-Fleet system-sourced placement when a later source supplies a different real fleet opinion", () => {
    const current = { fleetId: "fleet-real-a", source: "system" as const };

    expect(reconcilePlacement(current, { matchedFleetId: "fleet-real-b" }, "fleet-unassigned")).toEqual({
      fleetId: "fleet-real-b",
      source: "system",
    });
  });

  it("normalizes an external company label so equivalent spellings match", () => {
    expect(normalizeCompanyLabel("  Acme   Transport  ")).toBe("acme transport");
    expect(normalizeCompanyLabel("ACME TRANSPORT")).toBe("acme transport");
  });

  it("stages a candidate scoped to its connection's tenant, unbound, without embedding the connection's credential", () => {
    const connection: ProviderConnection = { id: "conn-1", organizationId: "org-a", credentialRef: "cred-ref-1" };

    const candidate = stageCandidate("candidate-1", connection, "Acme Transport");

    expect(candidate).toEqual({ id: "candidate-1", organizationId: "org-a", connectionId: "conn-1", normalizedLabel: "acme transport" });
    expect(candidate).not.toHaveProperty("credentialRef");
  });

  it("binds a staged candidate to a canonical Company while preserving its staging identity", () => {
    const connection: ProviderConnection = { id: "conn-1", organizationId: "org-a", credentialRef: "cred-ref-1" };
    const candidate = stageCandidate("candidate-1", connection, "Acme Transport");

    const bound = bindCandidateToCompany(candidate, "company-1");

    expect(bound).toEqual({ ...candidate, companyId: "company-1" });
  });
});
