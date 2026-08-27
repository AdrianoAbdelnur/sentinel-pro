export type HowenFleet = { guid?: string; parentid?: string; contacts?: string; name?: string };
export type HowenFleetResolution = { directFleetId?: string; companySourceFleetId?: string; company?: string; outcome: "direct" | "ancestor" | "unresolved" };

export function createHowenFleetCompanyResolver(fleets: readonly HowenFleet[]): (fleetId: string | undefined) => HowenFleetResolution {
  const byGuid = new Map(fleets.flatMap((fleet) => fleet.guid?.trim() ? [[fleet.guid.trim(), fleet]] as const : []));
  return (fleetId) => resolveFromIndex(byGuid, fleetId);
}

function resolveFromIndex(byGuid: ReadonlyMap<string, HowenFleet>, fleetId: string | undefined): HowenFleetResolution {
  const directFleetId = fleetId?.trim() || undefined;
  if (!directFleetId) return { outcome: "unresolved" };
  const visited = new Set<string>();
  let current = directFleetId;
  let first = true;
  while (current && !visited.has(current)) {
    visited.add(current);
    const fleet = byGuid.get(current);
    if (!fleet) break;
    const company = fleet.contacts?.trim();
    if (company) return { directFleetId, companySourceFleetId: current, company, outcome: first ? "direct" : "ancestor" };
    current = fleet.parentid?.trim() || "";
    first = false;
  }
  return { directFleetId, outcome: "unresolved" };
}

export function resolveHowenFleetCompany(fleets: readonly HowenFleet[], fleetId: string | undefined): HowenFleetResolution {
  return createHowenFleetCompanyResolver(fleets)(fleetId);
}
