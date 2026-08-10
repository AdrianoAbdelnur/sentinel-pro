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

export type FleetBindingOutcome =
  | { kind: "reused"; fleetId: string }
  | { kind: "review"; candidateFleetIds?: string[] };

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
  if (exactMatch) return { kind: "reused", fleetId: exactMatch.fleetId as string };
  const candidateFleetIds = [
    ...new Set(
      existingIdentities
        .filter(
          (identity) =>
            identity.fleetId !== undefined &&
            identity.organizationId === candidate.organizationId &&
            identity.label === candidate.label,
        )
        .map((identity) => identity.fleetId as string),
    ),
  ];
  return candidateFleetIds.length > 0 ? { kind: "review", candidateFleetIds } : { kind: "review" };
}
