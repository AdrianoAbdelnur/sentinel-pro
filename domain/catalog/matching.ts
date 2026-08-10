import type { ProviderConnection } from "./company-candidate";

export type VehicleIdentityPresence = "present" | "absent";

export type ExternalVehicleIdentity = {
  id: string;
  organizationId: string;
  connectionId: string;
  entityKind: "vehicle";
  externalId: string;
  vehicleId?: string;
  lastSeenRunId?: string;
  presence?: VehicleIdentityPresence;
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

export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export type ActiveCompanyVehicle = {
  vehicleId: string;
  organizationId: string;
  companyId: string;
  normalizedPlate: string;
  label?: string;
  active: boolean;
};

export type PlateMatchQuery = {
  organizationId: string;
  connectionId: string;
  companyId: string;
  externalId: string;
  normalizedPlate: string;
};

export type PlateMatchOutcome =
  | { kind: "auto-linked"; vehicleId: string }
  | { kind: "unmatched" }
  | { kind: "review" };

export function resolvePlateMatch(
  query: PlateMatchQuery,
  companyVehicles: ActiveCompanyVehicle[],
  existingIdentities: ExternalVehicleIdentity[],
): PlateMatchOutcome {
  if (query.normalizedPlate === "") return { kind: "unmatched" };
  const activeMatches = companyVehicles.filter(
    (vehicle) =>
      vehicle.active &&
      vehicle.organizationId === query.organizationId &&
      vehicle.companyId === query.companyId &&
      vehicle.normalizedPlate === query.normalizedPlate,
  );
  if (activeMatches.length === 0) return { kind: "unmatched" };
  if (activeMatches.length > 1) return { kind: "review" };
  const [match] = activeMatches;
  const conflictingIdentity = existingIdentities.find(
    (identity) =>
      identity.vehicleId === match.vehicleId &&
      identity.organizationId === query.organizationId &&
      identity.connectionId === query.connectionId &&
      identity.entityKind === "vehicle" &&
      identity.externalId !== query.externalId,
  );
  if (conflictingIdentity) return { kind: "review" };
  return { kind: "auto-linked", vehicleId: match.vehicleId };
}

export type VehicleMatchOutcome =
  | { kind: "reused"; vehicleId: string }
  | { kind: "auto-linked"; vehicleId: string }
  | { kind: "unmatched" }
  | { kind: "review" };

export function resolveVehicleMatch(
  query: PlateMatchQuery,
  existingIdentities: ExternalVehicleIdentity[],
  companyVehicles: ActiveCompanyVehicle[],
): VehicleMatchOutcome {
  const identityOutcome = resolveExternalVehicleIdentity(
    { organizationId: query.organizationId, connectionId: query.connectionId, entityKind: "vehicle", externalId: query.externalId },
    existingIdentities,
  );
  if (identityOutcome.kind === "reused") return identityOutcome;
  return resolvePlateMatch(query, companyVehicles, existingIdentities);
}
