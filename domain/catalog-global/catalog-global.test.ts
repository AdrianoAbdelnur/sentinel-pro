import { describe, expect, it } from "vitest";

import {
  createGlobalCatalogReview,
  createGlobalVehicle,
  createProviderConnection,
  createProviderContribution,
  createProviderDefinition,
  createProviderFleetMembership,
  createTenantVehicleGrant,
  resolveGlobalCatalogReview,
  retainGlobalVehiclePlacement,
  createSentinelGroup, createGroupEvidenceBinding, createVehiclePlacement,
  type GlobalCatalogReview,
  type GlobalVehicle,
  type ProviderContribution,
  type ProviderFleetMembership,
} from "./index";

describe("global catalog domain", () => {
  it("creates a global vehicle without tenant, Company, provider, or provider fleet identity", () => {
    const vehicle = createGlobalVehicle({
      id: "vehicle-1",
      normalizedPlate: "ABC123",
      plate: "ABC 123",
      placementFleetId: "sentinel-fleet-1",
    });

    expect(vehicle).toEqual({
      id: "vehicle-1",
      normalizedPlate: "ABC123",
      plate: "ABC 123",
      placementFleetId: "sentinel-fleet-1",
    });
    expect(vehicle).not.toHaveProperty("organizationId");
    expect(vehicle).not.toHaveProperty("companyId");
    expect(vehicle).not.toHaveProperty("providerId");
    expect(vehicle).not.toHaveProperty("externalFleetId");
  });

  it("retains Sentinel placement when a later contribution proposes another fleet", () => {
    const vehicle = createGlobalVehicle({
      id: "vehicle-1",
      normalizedPlate: "ABC123",
      plate: "ABC 123",
      placementFleetId: "sentinel-fleet-1",
    });

    const enriched = retainGlobalVehiclePlacement(vehicle, "provider-fleet-2");

    expect(enriched).toEqual(vehicle);
    expect(enriched.placementFleetId).toBe("sentinel-fleet-1");
  });

  it("records provider capabilities and presence independently of global identity", () => {
    const contribution = createProviderContribution({
      id: "contribution-1",
      connectionId: "connection-1",
      externalId: "external-1",
      vehicleId: "vehicle-1",
      capabilities: { video: "eligible", videoAlerts: "unsupported" },
      presence: "present",
    });

    expect(contribution).toEqual({
      id: "contribution-1",
      connectionId: "connection-1",
      externalId: "external-1",
      vehicleId: "vehicle-1",
      capabilities: { video: "eligible", videoAlerts: "unsupported" },
      presence: "present",
    });
  });

  it("keeps provider fleet memberships as separate metadata for the same vehicle", () => {
    const memberships: ProviderFleetMembership[] = [
      createProviderFleetMembership({
        connectionId: "connection-cyber",
        externalFleetId: "fleet-a",
        vehicleId: "vehicle-1",
        label: "North route",
      }),
      createProviderFleetMembership({
        connectionId: "connection-video",
        externalFleetId: "fleet-b",
        vehicleId: "vehicle-1",
        label: "Night route",
      }),
    ];

    expect(memberships).toEqual([
      {
        connectionId: "connection-cyber",
        externalFleetId: "fleet-a",
        vehicleId: "vehicle-1",
        label: "North route",
      },
      {
        connectionId: "connection-video",
        externalFleetId: "fleet-b",
        vehicleId: "vehicle-1",
        label: "Night route",
      },
    ]);
    expect(memberships.every((membership) => membership.vehicleId === "vehicle-1")).toBe(true);
  });

  it("creates tenant access as a grant without changing global identity", () => {
    const grant = createTenantVehicleGrant({ organizationId: "organization-1", vehicleId: "vehicle-1" });

    expect(grant).toEqual({ organizationId: "organization-1", vehicleId: "vehicle-1" });
    expect(grant).not.toHaveProperty("fleetId");
    expect(grant).not.toHaveProperty("companyId");
  });

  it("stages a global review with provider-neutral evidence", () => {
    const review = createGlobalCatalogReview({
      id: "review-1",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "ambiguous-match",
      normalizedPlate: "ABC123",
      candidateVehicleIds: ["vehicle-1", "vehicle-2"],
    });

    expect(review).toEqual({
      id: "review-1",
      subject: "vehicle-identity",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "ambiguous-match",
      normalizedPlate: "ABC123",
      candidateVehicleIds: ["vehicle-1", "vehicle-2"],
      status: "pending",
    });
  });

  it("resolves a pending global review without changing its provider-neutral subject", () => {
    const review = createGlobalCatalogReview({
      id: "review-1",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "conflicting-identity",
      candidateVehicleIds: ["vehicle-1"],
    });

    const resolved = resolveGlobalCatalogReview(review, "vehicle-1");

    expect(resolved).toEqual({
      ...review,
      status: "resolved",
      resolvedVehicleId: "vehicle-1",
    });
    expect(resolved.subject).toBe("vehicle-identity");
  });

  it("defines provider connections through neutral adapter keys and global capabilities", () => {
    const provider = createProviderDefinition({
      id: "provider-1",
      adapterKey: "adapter-key",
      capabilities: ["gps", "video"],
    });
    const connection = createProviderConnection({
      id: "connection-1",
      providerId: provider.id,
      credentialRef: "credential-ref",
      enabled: true,
      cadenceMinutes: 60,
    });

    expect(provider).toEqual({ id: "provider-1", adapterKey: "adapter-key", capabilities: ["gps", "video"] });
    expect(connection).toEqual({
      id: "connection-1",
      providerId: "provider-1",
      credentialRef: "credential-ref",
      enabled: true,
      cadenceMinutes: 60,
    });
    expect(provider.adapterKey).toBe("adapter-key");
  });

  it("preserves an already resolved review when resolution is repeated", () => {
    const review = createGlobalCatalogReview({
      id: "review-1",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "malformed-plate",
      candidateVehicleIds: [],
    });
    const resolved = resolveGlobalCatalogReview(review, "vehicle-1");

    expect(resolveGlobalCatalogReview(resolved, "vehicle-2")).toBe(resolved);
  });

  it("keeps absent contributions valid without inventing capability values", () => {
    const contribution = createProviderContribution({
      id: "contribution-2",
      connectionId: "connection-2",
      externalId: "external-2",
      vehicleId: "vehicle-1",
      capabilities: {},
      presence: "absent",
    });

    expect(contribution.presence).toBe("absent");
    expect(contribution.capabilities).toEqual({});
  });

  it("keeps domain values immutable at runtime", () => {
    const values: Array<GlobalVehicle | ProviderContribution | ProviderFleetMembership | GlobalCatalogReview> = [
      createGlobalVehicle({ id: "vehicle-1", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "fleet-1" }),
      createProviderContribution({
        id: "contribution-1",
        connectionId: "connection-1",
        externalId: "external-1",
        vehicleId: "vehicle-1",
        capabilities: { gps: "eligible" },
        presence: "present",
      }),
      createProviderFleetMembership({ connectionId: "connection-1", externalFleetId: "fleet-1", vehicleId: "vehicle-1", label: "North" }),
      createGlobalCatalogReview({ id: "review-1", connectionId: "connection-1", externalId: "external-1", reason: "missing-plate", candidateVehicleIds: [] }),
    ];

    expect(values.every((value) => Object.isFrozen(value))).toBe(true);
  });
});

  it("creates stable canonical groups and auditable placement evidence", () => {
    const group = createSentinelGroup({ id: "group-1", label: "North" });
    const binding = createGroupEvidenceBinding({ id: "binding-1", groupId: group.id, evidence: { connectionId: "c", kind: "company-label", externalKey: "north", label: "North", authority: "authoritative" } });
    const vehicle = createGlobalVehicle({ id: "vehicle-1", normalizedPlate: "ABC123", plate: "ABC 123", placementFleetId: "legacy", placement: createVehiclePlacement({ groupId: group.id, authority: "authoritative", evidenceBindingId: binding.id, assignedAt: new Date("2026-01-01") }) });
    expect(group).toEqual({ id: "group-1", label: "North" });
    expect(binding.evidence.authority).toBe("authoritative");
    expect(vehicle.placement?.groupId).toBe(group.id);
    expect(Object.isFrozen(binding.evidence)).toBe(true);
  });

  it("does not merge ambiguous group evidence and records a review", () => {
    const review = createGlobalCatalogReview({ id: "review-1", connectionId: "c", externalId: "north", reason: "ambiguous-group-evidence", candidateVehicleIds: [], evidenceKey: "north", candidateGroupIds: ["g1", "g2"] });
    expect(review.reason).toBe("ambiguous-group-evidence");
    expect(review.candidateGroupIds).toEqual(["g1", "g2"]);
  });
