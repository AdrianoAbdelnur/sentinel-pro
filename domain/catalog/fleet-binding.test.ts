import { describe, expect, it } from "vitest";

import type { ProviderConnection } from "./company-candidate";
import {
  bindExternalFleetIdentity,
  normalizeFleetName,
  resolveExternalFleetBinding,
  stageExternalFleetIdentity,
  type ExternalFleetIdentity,
} from "./fleet-binding";

const connectionCybermapa: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "cred-cyber" };
const connectionHowen: ProviderConnection = { id: "conn-howen", organizationId: "org-a", credentialRef: "cred-howen" };

describe("provider fleet binding", () => {
  it("normalizes an external fleet name so equivalent spellings compare equal", () => {
    expect(normalizeFleetName("  North   Route  ")).toBe("north route");
    expect(normalizeFleetName("NORTH ROUTE")).toBe("north route");
  });

  it("stages an external Fleet identity scoped to its connection's tenant, unbound", () => {
    const identity = stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route");

    expect(identity).toEqual({
      id: "identity-1",
      organizationId: "org-a",
      connectionId: "conn-cyber",
      entityKind: "fleet",
      externalId: "F100",
      label: "north route",
    });
  });

  it("lets an administrator bind a second, different provider's Fleet identity to the same canonical Fleet as an existing one", () => {
    const cybermapaIdentity = bindExternalFleetIdentity(
      stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route"),
      "fleet-1",
    );
    const howenIdentity = stageExternalFleetIdentity("identity-2", connectionHowen, "H900", "North Route (Howen)");

    const boundHowenIdentity = bindExternalFleetIdentity(howenIdentity, "fleet-1");

    expect(cybermapaIdentity.fleetId).toBe("fleet-1");
    expect(boundHowenIdentity.fleetId).toBe("fleet-1");
  });

  it("reuses the existing binding when a verified external Fleet identity repeats, matching exactly by connection and external id", () => {
    const identities: ExternalFleetIdentity[] = [
      bindExternalFleetIdentity(stageExternalFleetIdentity("identity-2", connectionCybermapa, "F200", "South Route"), "fleet-2"),
      bindExternalFleetIdentity(stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route"), "fleet-1"),
    ];

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route" },
      identities,
    );

    expect(outcome).toEqual({ kind: "reused", fleetId: "fleet-1" });
  });

  it("sends a duplicate import retry of an unbound external Fleet identity to review, never reusing a binding it does not yet have", () => {
    const unboundIdentity = stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route");

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route" },
      [unboundIdentity],
    );

    expect(outcome).toEqual({ kind: "review" });
  });

  it("does not reuse a binding across different connections even when the tenant and external id match, but surfaces the same-named bound Fleet as a review candidate", () => {
    const identities: ExternalFleetIdentity[] = [
      bindExternalFleetIdentity(stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route"), "fleet-1"),
    ];

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "F100", label: "north route" },
      identities,
    );

    expect(outcome).toEqual({ kind: "review", candidateFleetIds: ["fleet-1"] });
  });

  it("does not reuse a binding across tenants even when the connection and external id match", () => {
    const identities: ExternalFleetIdentity[] = [
      bindExternalFleetIdentity(stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route"), "fleet-1"),
    ];

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-b", connectionId: "conn-cyber", entityKind: "fleet", externalId: "F100", label: "north route" },
      identities,
    );

    expect(outcome).toEqual({ kind: "review" });
  });

  it("sends a brand new external Fleet identity to review instead of auto-binding it", () => {
    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route" },
      [],
    );

    expect(outcome).toEqual({ kind: "review" });
  });

  it("never auto-binds or merges two unbound external Fleets that only share a normalized name, offering the shared-name Fleet only as a review candidate", () => {
    const boundCybermapa = bindExternalFleetIdentity(
      stageExternalFleetIdentity("identity-1", connectionCybermapa, "F100", "North Route"),
      "fleet-1",
    );

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route" },
      [boundCybermapa],
    );

    expect(outcome).toEqual({ kind: "review", candidateFleetIds: ["fleet-1"] });
  });

  it("does not leak another tenant's identically named bound Fleet into the review candidate list", () => {
    const identities: ExternalFleetIdentity[] = [
      bindExternalFleetIdentity(stageExternalFleetIdentity("identity-1", { id: "conn-cyber", organizationId: "org-b", credentialRef: "cred-b" }, "F100", "North Route"), "fleet-b"),
    ];

    const outcome = resolveExternalFleetBinding(
      { organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route" },
      identities,
    );

    expect(outcome).toEqual({ kind: "review" });
  });
});
