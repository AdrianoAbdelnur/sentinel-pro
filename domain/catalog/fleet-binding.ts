import type { ProviderConnection } from "./company-candidate";

export type ExternalFleetIdentity = {
  id: string;
  organizationId: string;
  connectionId: string;
  entityKind: "fleet";
  externalId: string;
  label: string;
  fleetId?: string;
};

export function normalizeFleetName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function stageExternalFleetIdentity(
  id: string,
  connection: ProviderConnection,
  externalId: string,
  label: string,
): ExternalFleetIdentity {
  return {
    id,
    organizationId: connection.organizationId,
    connectionId: connection.id,
    entityKind: "fleet",
    externalId,
    label: normalizeFleetName(label),
  };
}

export function bindExternalFleetIdentity(identity: ExternalFleetIdentity, fleetId: string): ExternalFleetIdentity {
  return { ...identity, fleetId };
}

export type FleetBindingCandidate = {
  organizationId: string;
  connectionId: string;
  entityKind: "fleet";
  externalId: string;
  label: string;
};

export type FleetBindingOutcome = { kind: "reused"; fleetId: string } | { kind: "review" };

export function resolveExternalFleetBinding(
  candidate: FleetBindingCandidate,
  existingIdentities: ExternalFleetIdentity[],
): FleetBindingOutcome {
  const exactMatch = existingIdentities.find(
    (identity) =>
      identity.fleetId !== undefined &&
      identity.organizationId === candidate.organizationId &&
      identity.connectionId === candidate.connectionId &&
      identity.entityKind === candidate.entityKind &&
      identity.externalId === candidate.externalId,
  );
  return exactMatch ? { kind: "reused", fleetId: exactMatch.fleetId as string } : { kind: "review" };
}
