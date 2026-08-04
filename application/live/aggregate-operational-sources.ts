import type {
  LiveState,
  OperationalSnapshot,
  OperationalSource,
  OperationalSourceIdentity,
  OperationalSourceWarning,
} from "./contracts";

type IdentitySets = {
  fleets: Set<string>;
  vehicles: Set<string>;
  devices: Set<string>;
};

function warning(
  identity: OperationalSourceIdentity,
): OperationalSourceWarning {
  return {
    code: "source-unavailable",
    sourceId: identity.id,
    sourceLabel: identity.label,
  };
}
function collectIdentities(state: LiveState): IdentitySets {
  return {
    fleets: new Set(state.fleets.map(({ fleetId }) => fleetId)),
    vehicles: new Set(state.liveVehicles.map(({ vehicle }) => vehicle.id)),
    devices: new Set(
      state.liveVehicles.flatMap(({ device }) => (device ? [device.id] : [])),
    ),
  };
}

function hasIdentityCollision(
  state: LiveState,
  accepted: IdentitySets,
): boolean {
  const candidate = collectIdentities(state);
  const expectedCounts = {
    fleets: state.fleets.length,
    vehicles: state.liveVehicles.length,
    devices: state.liveVehicles.filter(({ device }) => device).length,
  };

  const identityKinds = Object.keys(candidate) as (keyof IdentitySets)[];

  return identityKinds.some((kind) =>
    candidate[kind].size !== expectedCounts[kind] ||
    [...candidate[kind]].some((id) => accepted[kind].has(id)));
}
function acceptIdentities(state: LiveState, accepted: IdentitySets): void {
  const candidate = collectIdentities(state);

  const identityKinds = Object.keys(candidate) as (keyof IdentitySets)[];

  for (const kind of identityKinds) {
    for (const id of candidate[kind]) {
      accepted[kind].add(id);
    }
  }
}

export async function aggregateOperationalSources(
  sources: OperationalSource[],
): Promise<OperationalSnapshot> {
  const outcomes = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await source.loadSnapshot();
        return {
          identity: source.identity,
          state: result.kind === "success" ? result.state : undefined,
        };
      } catch {
        return { identity: source.identity };
      }
    }),
  );
  const accepted: IdentitySets = {
    fleets: new Set(),
    vehicles: new Set(),
    devices: new Set(),
  };
  const state: LiveState = { fleets: [], liveVehicles: [] };
  const warnings: OperationalSourceWarning[] = [];

  for (const outcome of outcomes) {
    if (!outcome.state || hasIdentityCollision(outcome.state, accepted)) {
      warnings.push(warning(outcome.identity));
      continue;
    }

    state.fleets.push(...outcome.state.fleets);
    state.liveVehicles.push(...outcome.state.liveVehicles);
    acceptIdentities(outcome.state, accepted);
  }

  return { state, warnings };
}
