import { describe, expect, it } from "vitest";

import type { ProviderConnection } from "./company-candidate";
import {
  bindExternalVehicleIdentity,
  resolveExternalVehicleIdentity,
  stageExternalVehicleIdentity,
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
});
