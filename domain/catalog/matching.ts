import type { ProviderConnection } from "./company-candidate";

export type ExternalVehicleIdentity = {
  id: string;
  organizationId: string;
  connectionId: string;
  entityKind: "vehicle";
  externalId: string;
  vehicleId?: string;
};

export function stageExternalVehicleIdentity(
  id: string,
  connection: ProviderConnection,
  externalId: string,
): ExternalVehicleIdentity {
  return {
    id,
    organizationId: connection.organizationId,
    connectionId: connection.id,
    entityKind: "vehicle",
    externalId,
  };
}

export function bindExternalVehicleIdentity(identity: ExternalVehicleIdentity, vehicleId: string): ExternalVehicleIdentity {
  return { ...identity, vehicleId };
}

export type VehicleIdentityCandidate = {
  organizationId: string;
  connectionId: string;
  entityKind: "vehicle";
  externalId: string;
};

export type VehicleIdentityMatchOutcome = { kind: "reused"; vehicleId: string } | { kind: "unmatched" };

export function resolveExternalVehicleIdentity(
  candidate: VehicleIdentityCandidate,
  existingIdentities: ExternalVehicleIdentity[],
): VehicleIdentityMatchOutcome {
  const exactMatch = existingIdentities.find(
    (identity) =>
      identity.vehicleId !== undefined &&
      identity.organizationId === candidate.organizationId &&
      identity.connectionId === candidate.connectionId &&
      identity.entityKind === candidate.entityKind &&
      identity.externalId === candidate.externalId,
  );
  return exactMatch ? { kind: "reused", vehicleId: exactMatch.vehicleId as string } : { kind: "unmatched" };
}
