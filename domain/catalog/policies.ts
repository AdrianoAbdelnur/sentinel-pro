import type { Company, Fleet, VehiclePlacement } from "./entities";

export const UNASSIGNED_FLEET_NAME = "Unassigned";

export function createUnassignedFleet(id: string, companyId: string): Fleet {
  return { id, companyId, name: UNASSIGNED_FLEET_NAME, kind: "unassigned" };
}

export function belongsToOrganization(company: Company, organizationId: string): boolean {
  return company.organizationId === organizationId;
}

export type PlacementCandidate = { matchedFleetId?: string };

export function resolvePlacement(candidate: PlacementCandidate, unassignedFleetId: string): VehiclePlacement {
  return { fleetId: candidate.matchedFleetId ?? unassignedFleetId, source: "system" };
}

export function reconcilePlacement(
  current: VehiclePlacement,
  candidate: PlacementCandidate,
  unassignedFleetId: string,
): VehiclePlacement {
  return current.source === "admin" ? current : resolvePlacement(candidate, unassignedFleetId);
}
