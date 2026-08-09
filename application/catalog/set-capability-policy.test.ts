import { describe, expect, it } from "vitest";

import type { Capability, CapabilityPolicy, CapabilityPolicyScope, Company, Fleet, Vehicle } from "@/domain/catalog";

import { createCapabilityPolicyApplication } from "./set-capability-policy";
import type { CapabilityPolicyPorts } from "./ports";

function createFixture() {
  const companies = new Map<string, Company>();
  const fleets = new Map<string, Fleet>();
  const vehicles = new Map<string, Vehicle>();
  const policies = new Map<string, CapabilityPolicy>();
  let sequence = 0;
  const ports: CapabilityPolicyPorts = {
    companies: {
      findById: async (id) => companies.get(id),
      save: async (company) => { companies.set(company.id, company); },
    },
    fleets: {
      findById: async (id) => fleets.get(id),
      listByCompany: async (companyId) => [...fleets.values()].filter((fleet) => fleet.companyId === companyId),
      save: async (fleet) => { fleets.set(fleet.id, fleet); },
    },
    vehicles: {
      findById: async (id) => vehicles.get(id),
      listByCompany: async (companyId) => [...vehicles.values()].filter((vehicle) => vehicle.companyId === companyId),
      save: async (vehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    policies: {
      findByScope: async (organizationId, scope, scopeId, capability) =>
        [...policies.values()].find(
          (policy) =>
            policy.organizationId === organizationId &&
            policy.scope === scope &&
            policy.scopeId === scopeId &&
            policy.capability === capability,
        ),
      save: async (policy) => { policies.set(policy.id, policy); },
    },
    ids: { create: () => `policy-${++sequence}` },
  };
  companies.set("company-a", { id: "company-a", organizationId: "org-a", name: "Acme" });
  companies.set("company-b", { id: "company-b", organizationId: "org-b", name: "Globex" });
  fleets.set("fleet-a", { id: "fleet-a", companyId: "company-a", name: "North", kind: "standard" });
  fleets.set("fleet-b", { id: "fleet-b", companyId: "company-b", name: "South", kind: "standard" });
  vehicles.set("vehicle-a", { id: "vehicle-a", companyId: "company-a", origin: "native", placement: { fleetId: "fleet-a", source: "admin" } });
  vehicles.set("vehicle-b", { id: "vehicle-b", companyId: "company-b", origin: "native", placement: { fleetId: "fleet-b", source: "admin" } });
  return { app: createCapabilityPolicyApplication(ports), policies };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

const capability: Capability = "gps";

describe("capability source policy", () => {
  it("lets a tenant administrator set a Vehicle-scoped capability source policy", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-1", "conn-2"] });

    expect(result).toEqual({
      kind: "set",
      policy: { id: "policy-1", organizationId: "org-a", scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-1", "conn-2"] },
    });
  });

  it("rejects setting a policy from an operator or an administrator from a different tenant that owns the Vehicle", async () => {
    const fixture = createFixture();

    await expect(fixture.app.setCapabilityPolicy({ actor: operator, scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-1"] })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.app.setCapabilityPolicy({ actor: otherTenantAdmin, scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-1"] })).resolves.toEqual({ kind: "forbidden" });
    expect(fixture.policies.size).toBe(0);
  });

  it("rejects setting a Fleet-scoped policy when the Fleet belongs to another tenant", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "fleet", scopeId: "fleet-b", capability, sourceOrder: ["conn-1"] });

    expect(result).toEqual({ kind: "forbidden" });
  });

  it("rejects setting a Company-scoped policy when the Company belongs to another tenant", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "company", scopeId: "company-b", capability, sourceOrder: ["conn-1"] });

    expect(result).toEqual({ kind: "forbidden" });
  });

  it("lets a tenant administrator set an Organization-scoped policy for their own tenant", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "organization", scopeId: "org-a", capability, sourceOrder: ["conn-1"] });

    expect(result.kind).toBe("set");
  });

  it("rejects setting an Organization-scoped policy for a different tenant's organization id", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "organization", scopeId: "org-b", capability, sourceOrder: ["conn-1"] });

    expect(result).toEqual({ kind: "forbidden" });
  });

  it("rejects an unrecognized scope value instead of silently treating it as a Vehicle scope, even when scopeId matches a real, tenant-owned Vehicle", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({
      actor: admin,
      scope: "not-a-real-scope" as CapabilityPolicyScope,
      scopeId: "vehicle-a",
      capability,
      sourceOrder: ["conn-1"],
    });

    expect(result).toEqual({ kind: "forbidden" });
    expect(fixture.policies.size).toBe(0);
  });

  it("lets a tenant administrator set a Fleet-scoped capability source policy for a Fleet that belongs to their own tenant", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "fleet", scopeId: "fleet-a", capability, sourceOrder: ["conn-1"] });

    expect(result).toEqual({
      kind: "set",
      policy: { id: "policy-1", organizationId: "org-a", scope: "fleet", scopeId: "fleet-a", capability, sourceOrder: ["conn-1"] },
    });
  });

  it("lets a tenant administrator set a Company-scoped capability source policy for a Company that belongs to their own tenant", async () => {
    const fixture = createFixture();

    const result = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "company", scopeId: "company-a", capability, sourceOrder: ["conn-1"] });

    expect(result).toEqual({
      kind: "set",
      policy: { id: "policy-1", organizationId: "org-a", scope: "company", scopeId: "company-a", capability, sourceOrder: ["conn-1"] },
    });
  });

  it("updates the existing policy for the same scope and capability instead of duplicating it", async () => {
    const fixture = createFixture();
    const first = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-1"] });
    if (first.kind !== "set") throw new Error("expected policy to be set");

    const second = await fixture.app.setCapabilityPolicy({ actor: admin, scope: "vehicle", scopeId: "vehicle-a", capability, sourceOrder: ["conn-2"] });

    expect(second).toEqual({ kind: "set", policy: { ...first.policy, sourceOrder: ["conn-2"] } });
    expect(fixture.policies.size).toBe(1);
  });
});
