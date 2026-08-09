import { describe, expect, it } from "vitest";

import {
  resolveCapabilitySource,
  resolveCapabilitySourceOrder,
  resolveEligibleCapabilitySource,
  SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER,
  type CapabilityPolicy,
  type CapabilityScopeIds,
} from "./precedence";

const scopeIds: CapabilityScopeIds = {
  vehicle: "vehicle-1",
  fleet: "fleet-1",
  company: "company-1",
  organization: "org-a",
};

function eligible(...sourceIds: string[]): Record<string, "eligible"> {
  return Object.fromEntries(sourceIds.map((sourceId) => [sourceId, "eligible" as const]));
}

describe("capability independence", () => {
  it("keeps a Vehicle-level policy scoped to its own capability, never leaking into another capability's resolution", () => {
    const policies: CapabilityPolicy[] = [
      { id: "policy-1", organizationId: "org-a", scope: "vehicle", scopeId: "vehicle-1", capability: "gps", sourceOrder: ["gps-only-source"] },
    ];

    const gpsOrder = resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies);
    const videoOrder = resolveCapabilitySourceOrder("video", "org-a", scopeIds, policies);

    expect(gpsOrder).toEqual(["gps-only-source"]);
    expect(videoOrder).toEqual(SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER.video);
  });

  it("does not let a Vehicle-level policy from another tenant apply, even when scope and scopeId collide", () => {
    const policies: CapabilityPolicy[] = [
      { id: "policy-leak", organizationId: "org-b", scope: "vehicle", scopeId: "vehicle-1", capability: "gps", sourceOrder: ["org-b-leak-source"] },
      { id: "policy-own", organizationId: "org-a", scope: "vehicle", scopeId: "vehicle-1", capability: "gps", sourceOrder: ["org-a-source"] },
    ];

    const order = resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies);

    expect(order).toEqual(["org-a-source"]);
  });
});

describe("five precedence levels, most specific wins", () => {
  it("applies the Vehicle policy over Fleet, Company, and Organization policies for the same capability", () => {
    const policies: CapabilityPolicy[] = [
      { id: "p-vehicle", organizationId: "org-a", scope: "vehicle", scopeId: "vehicle-1", capability: "gps", sourceOrder: ["v-src"] },
      { id: "p-fleet", organizationId: "org-a", scope: "fleet", scopeId: "fleet-1", capability: "gps", sourceOrder: ["f-src"] },
      { id: "p-company", organizationId: "org-a", scope: "company", scopeId: "company-1", capability: "gps", sourceOrder: ["c-src"] },
      { id: "p-org", organizationId: "org-a", scope: "organization", scopeId: "org-a", capability: "gps", sourceOrder: ["o-src"] },
    ];

    expect(resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies)).toEqual(["v-src"]);
  });

  it("applies the Fleet policy over Company and Organization policies when no Vehicle policy exists", () => {
    const policies: CapabilityPolicy[] = [
      { id: "p-fleet", organizationId: "org-a", scope: "fleet", scopeId: "fleet-1", capability: "gps", sourceOrder: ["f-src2"] },
      { id: "p-company", organizationId: "org-a", scope: "company", scopeId: "company-1", capability: "gps", sourceOrder: ["c-src2"] },
      { id: "p-org", organizationId: "org-a", scope: "organization", scopeId: "org-a", capability: "gps", sourceOrder: ["o-src2"] },
    ];

    expect(resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies)).toEqual(["f-src2"]);
  });

  it("applies the Company policy over the Organization policy when no Vehicle or Fleet policy exists", () => {
    const policies: CapabilityPolicy[] = [
      { id: "p-company", organizationId: "org-a", scope: "company", scopeId: "company-1", capability: "gps", sourceOrder: ["c-src3"] },
      { id: "p-org", organizationId: "org-a", scope: "organization", scopeId: "org-a", capability: "gps", sourceOrder: ["o-src3"] },
    ];

    expect(resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies)).toEqual(["c-src3"]);
  });

  it("applies the Organization policy over the system default when no Vehicle, Fleet, or Company policy exists", () => {
    const policies: CapabilityPolicy[] = [
      { id: "p-org", organizationId: "org-a", scope: "organization", scopeId: "org-a", capability: "gps", sourceOrder: ["o-src4"] },
    ];

    expect(resolveCapabilitySourceOrder("gps", "org-a", scopeIds, policies)).toEqual(["o-src4"]);
  });

  it("falls back to the system default order when no policy exists at any level", () => {
    expect(resolveCapabilitySourceOrder("gps", "org-a", scopeIds, [])).toEqual(SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER.gps);
  });
});

describe("system defaults", () => {
  it("uses each capability's declared default source when eligible Cybermapa and Howen sources both exist for the Vehicle", () => {
    const statuses = eligible("cybermapa", "howen");

    expect(resolveCapabilitySource("gps", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "cybermapa" });
    expect(resolveCapabilitySource("operationalAlerts", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "cybermapa" });
    expect(resolveCapabilitySource("video", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "howen" });
    expect(resolveCapabilitySource("videoAlerts", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "howen" });
  });
});

describe("ordered fallback", () => {
  it("tries the next source in order when the preferred source cannot serve for any reason: absent, unsupported, stale, or unavailable", () => {
    const order = ["preferred", "fallback"] as const;

    for (const reason of ["absent", "unsupported", "stale", "unavailable"] as const) {
      const resolution = resolveEligibleCapabilitySource(order, { preferred: reason, fallback: "eligible" });
      expect(resolution).toEqual({ kind: "resolved", source: "fallback" });
    }
  });

  it("reports the capability unavailable when no ordered source is eligible", () => {
    const order = ["a", "b"] as const;

    const resolution = resolveEligibleCapabilitySource(order, { a: "absent", b: "stale" });

    expect(resolution).toEqual({ kind: "unavailable" });
  });

  it("lets a Vehicle with only one eligible provider-only source still serve that capability", () => {
    const policies: CapabilityPolicy[] = [
      { id: "p-video", organizationId: "org-a", scope: "vehicle", scopeId: "vehicle-1", capability: "video", sourceOrder: ["howen-only"] },
    ];

    const resolution = resolveCapabilitySource("video", "org-a", scopeIds, policies, { "howen-only": "eligible" });

    expect(resolution).toEqual({ kind: "resolved", source: "howen-only" });
  });
});

describe("linked source absence", () => {
  it("marks only the capabilities lacking another eligible source unavailable when one linked source stops reporting the Vehicle", () => {
    const statuses = { cybermapa: "absent" as const, howen: "eligible" as const };

    expect(resolveCapabilitySource("gps", "org-a", scopeIds, [], statuses)).toEqual({ kind: "unavailable" });
    expect(resolveCapabilitySource("operationalAlerts", "org-a", scopeIds, [], statuses)).toEqual({ kind: "unavailable" });
    expect(resolveCapabilitySource("video", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "howen" });
    expect(resolveCapabilitySource("videoAlerts", "org-a", scopeIds, [], statuses)).toEqual({ kind: "resolved", source: "howen" });
  });
});
