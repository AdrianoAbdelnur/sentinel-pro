import { describe, expect, it } from "vitest";

import type { ProviderConnection } from "./company-candidate";
import {
  bindExternalVehicleIdentity,
  markExternalVehicleIdentityAbsent,
  markExternalVehicleIdentitySeen,
  normalizePlate,
  resolveExternalVehicleIdentity,
  resolvePlateMatch,
  resolveVehicleMatch,
  setVehicleIdentityCapabilityStates,
  stageExternalVehicleIdentity,
  type ActiveCompanyVehicle,
  type ExternalVehicleIdentity,
} from "./matching";

const connectionCybermapa: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "cred-cyber" };
const connectionHowen: ProviderConnection = { id: "conn-howen", organizationId: "org-a", credentialRef: "cred-howen" };

describe("external vehicle identity linking", () => {
  it("stages an external Vehicle identity scoped to its connection's tenant, unbound, using Cybermapa's gps_id as the external identifier", () => {
    const identity = stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001");

    expect(identity).toEqual({
      id: "identity-1",
      organizationId: "org-a",
      connectionId: "conn-cyber",
      entityKind: "vehicle",
      externalId: "gps-9001",
    });
  });

  it("reuses the existing link when a deterministic external Vehicle identity repeats, matching exactly by connection and external id", () => {
    const identities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"),
    ];

    const outcome = resolveExternalVehicleIdentity(
      { organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001" },
      identities,
    );

    expect(outcome).toEqual({ kind: "reused", vehicleId: "vehicle-1" });
  });

  it("keeps distinct scoped identities when two connections report the same external identifier", () => {
    const identities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"),
    ];

    const outcome = resolveExternalVehicleIdentity(
      { organizationId: "org-a", connectionId: connectionHowen.id, entityKind: "vehicle", externalId: "gps-9001" },
      identities,
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("does not reuse a link across tenants even when the connection and external id match", () => {
    const identities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"),
    ];

    const outcome = resolveExternalVehicleIdentity(
      { organizationId: "org-b", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001" },
      identities,
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("does not reuse an unbound identity, leaving matching to fall through to plate evaluation", () => {
    const unboundIdentity = stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001");

    const outcome = resolveExternalVehicleIdentity(
      { organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001" },
      [unboundIdentity],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("retains exactly one Company-scoped link when a repeated import follows an administrator's review resolution", () => {
    const resolvedIdentity = bindExternalVehicleIdentity(
      stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"),
      "vehicle-1",
    );

    const outcome = resolveExternalVehicleIdentity(
      { organizationId: "org-a", connectionId: "conn-cyber", entityKind: "vehicle", externalId: "gps-9001" },
      [resolvedIdentity],
    );

    expect(outcome).toEqual({ kind: "reused", vehicleId: "vehicle-1" });
  });

  it("sets bounded per-capability source states on an external Vehicle identity independently of presence and last sighting", () => {
    const identity = bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1");

    const updated = setVehicleIdentityCapabilityStates(identity, { gps: "eligible", operationalAlerts: "unsupported" });

    expect(updated).toEqual({ ...identity, capabilityStates: { gps: "eligible", operationalAlerts: "unsupported" } });
  });
});

describe("normalizePlate", () => {
  it("normalizes plate punctuation and casing so equivalent plates compare equal", () => {
    expect(normalizePlate("abc-123")).toBe("ABC123");
    expect(normalizePlate(" ABC 123 ")).toBe("ABC123");
  });
});

describe("Company-scoped plate matching", () => {
  const companyA = "company-a";
  const companyB = "company-b";

  it("auto-links when exactly one active Vehicle matches the normalized plate inside the bound Company", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9002", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "auto-linked", vehicleId: "vehicle-1" });
  });

  it("signals no match when no Vehicle in the bound Company matches the plate", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ZZZ999", active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9002", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("sends a Vehicle to review instead of auto-linking when two distinct active Vehicles in the same Company share the same plate, naming both as review candidates", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
      { vehicleId: "vehicle-2", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9003", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "review", candidateVehicleIds: ["vehicle-1", "vehicle-2"] });
  });

  it("sends a Vehicle to review instead of auto-linking when the single plate match already carries a conflicting deterministic identity from the same connection, naming that Vehicle as the review candidate", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];
    const existingIdentities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-old"), "vehicle-1"),
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-new", normalizedPlate: "ABC123" },
      companyVehicles,
      existingIdentities,
    );

    expect(outcome).toEqual({ kind: "review", candidateVehicleIds: ["vehicle-1"] });
  });

  it("does not auto-link when the only active identity on the matched Vehicle is this very candidate's own identity", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];
    const existingIdentities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"),
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9001", normalizedPlate: "ABC123" },
      companyVehicles,
      existingIdentities,
    );

    expect(outcome).toEqual({ kind: "auto-linked", vehicleId: "vehicle-1" });
  });

  it("does not auto-link when the plate match exists only in another Company", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyB, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9002", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("does not auto-link when the plate match belongs to a different tenant even though the companyId happens to match", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-b", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9002", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("ignores an inactive same-plate Vehicle inside the Company, leaving the sole active Vehicle as the safe match", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
      { vehicleId: "vehicle-2", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: false },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9003", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "auto-linked", vehicleId: "vehicle-1" });
  });

  it("does not auto-link when only a name or alias matches without an exact Company plate match", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ZZZ999", active: true, label: "north route unit" },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9002", normalizedPlate: "ABC123" },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });

  it("auto-links a replacement device onto the plate-matched Vehicle when the prior conflicting identity on the same connection is marked absent", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];
    const existingIdentities: ExternalVehicleIdentity[] = [
      { ...bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-old", connectionCybermapa, "gps-old"), "vehicle-1"), presence: "absent" },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-new", normalizedPlate: "ABC123" },
      companyVehicles,
      existingIdentities,
    );

    expect(outcome).toEqual({ kind: "auto-linked", vehicleId: "vehicle-1" });
  });

  it("never auto-links two unrelated Vehicles that both have missing plate data, even when they normalize to the same blank value", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: normalizePlate(""), active: true },
    ];

    const outcome = resolvePlateMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9004", normalizedPlate: normalizePlate("  --  ") },
      companyVehicles,
      [],
    );

    expect(outcome).toEqual({ kind: "unmatched" });
  });
});

describe("resolveVehicleMatch", () => {
  const companyA = "company-a";

  it("reuses the Vehicle by deterministic identity, never consulting the plate when one already exists", () => {
    const existingIdentities: ExternalVehicleIdentity[] = [
      bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"),
    ];
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-2", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolveVehicleMatch(
      { organizationId: "org-a", connectionId: "conn-cyber", companyId: companyA, externalId: "gps-9001", normalizedPlate: "ABC123" },
      existingIdentities,
      companyVehicles,
    );

    expect(outcome).toEqual({ kind: "reused", vehicleId: "vehicle-1" });
  });

  it("falls back to a safe plate match and enriches the existing canonical Vehicle instead of creating a duplicate when no identity exists yet", () => {
    const companyVehicles: ActiveCompanyVehicle[] = [
      { vehicleId: "vehicle-1", organizationId: "org-a", companyId: companyA, normalizedPlate: "ABC123", active: true },
    ];

    const outcome = resolveVehicleMatch(
      { organizationId: "org-a", connectionId: connectionHowen.id, companyId: companyA, externalId: "howen-77", normalizedPlate: "ABC123" },
      [],
      companyVehicles,
    );

    expect(outcome).toEqual({ kind: "auto-linked", vehicleId: "vehicle-1" });
  });
});

describe("external vehicle identity presence tracking", () => {
  it("marks an identity seen in the given run as present, bumping only lastSeenRunId and presence", () => {
    const identity = bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1");

    const seen = markExternalVehicleIdentitySeen(identity, "run-2");

    expect(seen).toEqual({ ...identity, lastSeenRunId: "run-2", presence: "present" });
  });

  it("marks an identity absent without touching its vehicle link, external id, or last-seen run", () => {
    const identity = markExternalVehicleIdentitySeen(bindExternalVehicleIdentity(stageExternalVehicleIdentity("identity-1", connectionCybermapa, "gps-9001"), "vehicle-1"), "run-1");

    const absent = markExternalVehicleIdentityAbsent(identity);

    expect(absent).toEqual({ ...identity, presence: "absent" });
  });
});
