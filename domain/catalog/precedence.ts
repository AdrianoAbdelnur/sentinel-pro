export type Capability = "gps" | "operationalAlerts" | "video" | "videoAlerts";

export type CapabilitySourceId = string;
export type CapabilitySourceOrder = readonly CapabilitySourceId[];

export type CapabilityPolicyScope = "vehicle" | "fleet" | "company" | "organization";

export type CapabilityPolicy = {
  id: string;
  organizationId: string;
  scope: CapabilityPolicyScope;
  scopeId: string;
  capability: Capability;
  sourceOrder: CapabilitySourceOrder;
};

export type CapabilityScopeIds = Record<CapabilityPolicyScope, string>;

export const CAPABILITY_PRECEDENCE_SCOPES: readonly CapabilityPolicyScope[] = [
  "vehicle",
  "fleet",
  "company",
  "organization",
];

export const SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER: Record<Capability, CapabilitySourceOrder> = {
  gps: ["cybermapa"],
  operationalAlerts: ["cybermapa"],
  video: ["howen"],
  videoAlerts: ["howen"],
};

export function resolveCapabilitySourceOrder(
  capability: Capability,
  organizationId: string,
  scopeIds: CapabilityScopeIds,
  policies: readonly CapabilityPolicy[],
): CapabilitySourceOrder {
  const applicable = policies.filter(
    (policy) => policy.capability === capability && policy.organizationId === organizationId,
  );
  for (const scope of CAPABILITY_PRECEDENCE_SCOPES) {
    const match = applicable.find((policy) => policy.scope === scope && policy.scopeId === scopeIds[scope]);
    if (match) return match.sourceOrder;
  }
  return SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER[capability];
}

export type CapabilitySourceStatus = "eligible" | "absent" | "unsupported" | "stale" | "unavailable";
export type CapabilitySourceStatuses = Partial<Record<CapabilitySourceId, CapabilitySourceStatus>>;

export type CapabilityResolution = { kind: "resolved"; source: CapabilitySourceId } | { kind: "unavailable" };

export function resolveEligibleCapabilitySource(
  sourceOrder: CapabilitySourceOrder,
  statuses: CapabilitySourceStatuses,
): CapabilityResolution {
  const eligibleSource = sourceOrder.find((sourceId) => statuses[sourceId] === "eligible");
  return eligibleSource ? { kind: "resolved", source: eligibleSource } : { kind: "unavailable" };
}

export function resolveCapabilitySource(
  capability: Capability,
  organizationId: string,
  scopeIds: CapabilityScopeIds,
  policies: readonly CapabilityPolicy[],
  statuses: CapabilitySourceStatuses,
): CapabilityResolution {
  const sourceOrder = resolveCapabilitySourceOrder(capability, organizationId, scopeIds, policies);
  return resolveEligibleCapabilitySource(sourceOrder, statuses);
}
