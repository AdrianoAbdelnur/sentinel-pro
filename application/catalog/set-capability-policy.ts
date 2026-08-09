import {
  belongsToOrganization,
  type Capability,
  type CapabilityPolicy,
  type CapabilityPolicyScope,
  type CapabilitySourceOrder,
} from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type { SetCapabilityPolicyResult } from "./contracts";
import type { CapabilityPolicyPorts } from "./ports";

export function createCapabilityPolicyApplication(ports: CapabilityPolicyPorts) {
  async function isScopeInTenant(scope: CapabilityPolicyScope, scopeId: string, organizationId: string): Promise<boolean> {
    if (scope === "organization") return scopeId === organizationId;
    if (scope === "company") {
      const company = await ports.companies.findById(scopeId);
      return Boolean(company && belongsToOrganization(company, organizationId));
    }
    if (scope === "fleet") {
      const fleet = await ports.fleets.findById(scopeId);
      const company = fleet && (await ports.companies.findById(fleet.companyId));
      return Boolean(company && belongsToOrganization(company, organizationId));
    }
    if (scope === "vehicle") {
      const vehicle = await ports.vehicles.findById(scopeId);
      const company = vehicle && (await ports.companies.findById(vehicle.companyId));
      return Boolean(company && belongsToOrganization(company, organizationId));
    }
    return false;
  }

  async function setCapabilityPolicy({
    actor,
    scope,
    scopeId,
    capability,
    sourceOrder,
  }: {
    actor: AuthorizationContext;
    scope: CapabilityPolicyScope;
    scopeId: string;
    capability: Capability;
    sourceOrder: CapabilitySourceOrder;
  }): Promise<SetCapabilityPolicyResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    if (!(await isScopeInTenant(scope, scopeId, actor.organizationId))) return { kind: "forbidden" };
    const existing = await ports.policies.findByScope(actor.organizationId, scope, scopeId, capability);
    const policy: CapabilityPolicy = {
      id: existing?.id ?? ports.ids.create(),
      organizationId: actor.organizationId,
      scope,
      scopeId,
      capability,
      sourceOrder,
    };
    await ports.policies.save(policy);
    return { kind: "set", policy };
  }

  return { setCapabilityPolicy };
}
