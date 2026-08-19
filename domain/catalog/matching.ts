import type { ProviderConnection } from "./company-candidate";
import type { Capability, CapabilitySourceStatus } from "./precedence";

export type VehicleIdentityPresence = "present" | "absent";
export type VehicleIdentityCapabilityStates = Partial<Record<Capability, CapabilitySourceStatus>>;

export type ExternalVehicleIdentity = {
  id: string;
  organizationId: string;
  connectionId: string;
  entityKind: "vehicle";
  externalId: string;
  vehicleId?: string;
  lastSeenRunId?: string;
  presence?: VehicleIdentityPresence;
  capabilityStates?: VehicleIdentityCapabilityStates;
};

export function setVehicleIdentityCapabilityStates(
  identity: ExternalVehicleIdentity,
  capabilityStates: VehicleIdentityCapabilityStates,
): ExternalVehicleIdentity {
  return { ...identity, capabilityStates };
}

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

export function markExternalVehicleIdentitySeen(identity: ExternalVehicleIdentity, runId: string): ExternalVehicleIdentity {
  return { ...identity, lastSeenRunId: runId, presence: "present" };
}

export function markExternalVehicleIdentityAbsent(identity: ExternalVehicleIdentity): ExternalVehicleIdentity {
  return { ...identity, presence: "absent" };
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

const PLATE_SEPARATOR_CHARACTERS = /[\s\-._/​-‍﻿]+/g;

export function normalizePlate(plate: string): string {
  return plate.trim().replace(PLATE_SEPARATOR_CHARACTERS, "").toUpperCase();
}

export type PlateFormat = "legacy" | "mercosur" | "unknown";

const LEGACY_PLATE_PATTERN = /^[A-Z]{3}\d{3}$/;
const MERCOSUR_PLATE_PATTERN = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

export function classifyPlateFormat(canonicalPlate: string): PlateFormat {
  if (LEGACY_PLATE_PATTERN.test(canonicalPlate)) return "legacy";
  if (MERCOSUR_PLATE_PATTERN.test(canonicalPlate)) return "mercosur";
  return "unknown";
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
  registeredPlate?: string;
  label?: string;
};

export type PlateMatchOutcome =
  | { kind: "auto-linked"; vehicleId: string }
  | { kind: "unmatched" }
  | { kind: "review"; candidateVehicleIds: string[] };

export function resolvePlateMatch(
  query: PlateMatchQuery,
  companyVehicles: ActiveCompanyVehicle[],
  existingIdentities: ExternalVehicleIdentity[],
): PlateMatchOutcome {
  const registeredPlate = query.registeredPlate ?? query.normalizedPlate;
  if (registeredPlate === "") return { kind: "unmatched" };
  const activeMatches = companyVehicles.filter(
    (vehicle) =>
      vehicle.active &&
      vehicle.organizationId === query.organizationId &&
      vehicle.companyId === query.companyId &&
      vehicle.normalizedPlate === registeredPlate,
  );
  if (activeMatches.length === 0) return { kind: "unmatched" };
  if (activeMatches.length > 1) return { kind: "review", candidateVehicleIds: activeMatches.map((vehicle) => vehicle.vehicleId) };
  const [match] = activeMatches;
  const conflictingIdentity = existingIdentities.find(
    (identity) =>
      identity.vehicleId === match.vehicleId &&
      identity.organizationId === query.organizationId &&
      identity.connectionId === query.connectionId &&
      identity.entityKind === "vehicle" &&
      identity.externalId !== query.externalId &&
      identity.presence !== "absent",
  );
  if (conflictingIdentity) return { kind: "review", candidateVehicleIds: [match.vehicleId] };
  return { kind: "auto-linked", vehicleId: match.vehicleId };
}

export type VehicleMatchOutcome =
  | { kind: "reused"; vehicleId: string }
  | { kind: "auto-linked"; vehicleId: string }
  | { kind: "unmatched" }
  | { kind: "review"; candidateVehicleIds: string[] };

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
  const plateOutcome = resolvePlateMatch(query, companyVehicles, existingIdentities);
  if (plateOutcome.kind !== "unmatched") return plateOutcome;
  const normalizedLabel = query.label === undefined ? "" : normalizePlate(query.label);
  if (normalizedLabel === "") return { kind: "unmatched" };
  const candidates = companyVehicles.filter((vehicle) => vehicle.active && vehicle.organizationId === query.organizationId && vehicle.companyId === query.companyId && vehicle.normalizedPlate === normalizedLabel);
  return candidates.length === 0 ? { kind: "unmatched" } : { kind: "review", candidateVehicleIds: candidates.map((vehicle) => vehicle.vehicleId) };
}
