import type { VehiclePlacement } from "./entities";
import { reconcilePlacement, type PlacementCandidate } from "./policies";

export function unionFleetRoster(rosters: string[][]): string[] {
  const vehicleIds = new Set<string>();
  for (const roster of rosters) {
    for (const vehicleId of roster) vehicleIds.add(vehicleId);
  }
  return [...vehicleIds];
}

export type PlacementReviewOutcome =
  | { kind: "resolved"; placement: VehiclePlacement }
  | { kind: "review"; placement: VehiclePlacement };

export function reconcileFleetPlacement(
  current: VehiclePlacement,
  candidateFleetIds: string[],
  unassignedFleetId: string,
): PlacementReviewOutcome {
  const distinctRealFleetIds = [...new Set(candidateFleetIds.filter((fleetId) => fleetId !== unassignedFleetId))];
  if (current.source !== "admin" && distinctRealFleetIds.length > 1) return { kind: "review", placement: current };
  const candidate: PlacementCandidate = { matchedFleetId: distinctRealFleetIds[0] };
  return { kind: "resolved", placement: reconcilePlacement(current, candidate, unassignedFleetId) };
}
