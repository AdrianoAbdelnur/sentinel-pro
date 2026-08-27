import { DEFAULT_CAPABILITY_SOURCE_ORDER } from "@/domain/catalog";
import type {
  CapabilityPolicy,
  CatalogVehicle,
  Provider,
  ProviderConnection,
  ProviderContribution,
  OrganizationVehicleAccess,
} from "@/domain/catalog";
import type { Device, DeviceTelemetry } from "@/domain/live";

import type { LiveState, LiveVehicleState, OperationalSource } from "./contracts";

export type CatalogFleet = {
  id: string;
  label: string;
};

export type CatalogGroupSummary = CatalogFleet & {
  vehicleCount: number;
};

export type CatalogCapabilitySnapshot = {
  device?: Device;
  telemetry?: DeviceTelemetry;
};

export type CatalogLiveInput = {
  organizationId: string;
  fleets: readonly CatalogFleet[];
  vehicles: readonly CatalogVehicle[];
  contributions: readonly ProviderContribution[];
  connections: readonly ProviderConnection[];
  providers?: readonly Provider[];
  policies: readonly CapabilityPolicy[];
  grants: readonly OrganizationVehicleAccess[];
  sourceSnapshots: Readonly<Record<string, Readonly<Record<string, CatalogCapabilitySnapshot>>>>;
};

export function projectCatalogGroupSummaries(summaries: readonly CatalogGroupSummary[]): LiveState {
  return {
    fleets: summaries.map((summary) => ({
      fleetId: summary.id,
      label: summary.label,
      vehicleIds: [],
      vehicleCount: summary.vehicleCount,
      isLoaded: false,
    })),
    liveVehicles: [],
  };
}

export function createCatalogSummaryOperationalSource(
  loadSummaries: () => Promise<readonly CatalogGroupSummary[]>,
): OperationalSource {
  return {
    identity: { id: "canonical-catalog", label: "Catálogo" },
    async loadSnapshot() {
      try {
        return { kind: "success", state: projectCatalogGroupSummaries(await loadSummaries()) };
      } catch {
        return { kind: "failure", code: "unavailable" };
      }
    },
  };
}

export function projectCatalogGroupVehicles(
  group: CatalogFleet,
  vehicles: readonly CatalogVehicle[],
  operational: Pick<CatalogLiveInput, "contributions" | "connections" | "providers" | "policies" | "sourceSnapshots"> = {
    contributions: [],
    connections: [],
    providers: [],
    policies: [],
    sourceSnapshots: {},
  },
): LiveState {
  const state = createCatalogLiveProjector()({
    organizationId: "group-load",
    fleets: [group],
    vehicles,
    contributions: operational.contributions,
    connections: operational.connections,
    providers: operational.providers,
    policies: operational.policies,
    grants: vehicles.map((vehicle) => ({ organizationId: "group-load", vehicleId: vehicle.id })),
    sourceSnapshots: operational.sourceSnapshots,
  });

  return {
    fleets: state.fleets.map((fleet) => ({
      ...fleet,
      vehicleCount: vehicles.length,
      isLoaded: true,
    })),
    liveVehicles: state.liveVehicles,
  };
}

function sourceOrder(capability: string, policies: readonly CapabilityPolicy[]): readonly string[] {
  return policies.find((policy) => policy.capability === capability)?.sourceOrder ?? DEFAULT_CAPABILITY_SOURCE_ORDER[capability] ?? [];
}

function assignedVehicleIds(input: CatalogLiveInput): Set<string> {
  return new Set(
    input.grants.filter((grant) => grant.organizationId === input.organizationId).map((grant) => grant.vehicleId),
  );
}

function enabledProviders(input: CatalogLiveInput): Map<string, string> {
  const providersById = new Map((input.providers ?? []).map((provider) => [provider.id, provider.adapterKey]));
  return new Map(input.connections.filter((connection) => connection.enabled).map((connection) => [connection.id, providersById.get(connection.providerId) ?? connection.providerId]));
}

type ResolvedCapabilitySource = {
  source: string;
  contribution: ProviderContribution;
};

function resolveSource(
  capability: string,
  contributions: readonly ProviderContribution[],
  providers: Map<string, string>,
  policies: readonly CapabilityPolicy[],
  snapshots: CatalogLiveInput["sourceSnapshots"],
): ResolvedCapabilitySource | undefined {
  const eligible = new Map<string, ProviderContribution>();
  for (const contribution of contributions) {
    const provider = providers.get(contribution.connectionId);
    const status = contribution.capabilities[capability];
    if (!provider || contribution.presence !== "present" || !status) continue;
    const snapshot = snapshots[contribution.connectionId]?.[contribution.externalId];
    const hasOperationalData = capability === "gps"
      ? snapshot?.telemetry !== undefined
      : capability === "video"
        ? snapshot?.device !== undefined
        : true;
    if (status === "eligible" && hasOperationalData) eligible.set(provider, contribution);
  }
  for (const source of sourceOrder(capability, policies)) {
    const contribution = eligible.get(source);
    if (contribution) return { source, contribution };
  }
  return undefined;
}

function snapshotFor(
  resolved: ResolvedCapabilitySource | undefined,
  snapshots: CatalogLiveInput["sourceSnapshots"],
): CatalogCapabilitySnapshot | undefined {
  return resolved ? snapshots[resolved.contribution.connectionId]?.[resolved.contribution.externalId] : undefined;
}

function projectVehicle(vehicle: CatalogVehicle, input: CatalogLiveInput, providers: Map<string, string>): LiveVehicleState {
  const contributions = input.contributions.filter((contribution) => contribution.vehicleId === vehicle.id);
  const gpsSource = resolveSource("gps", contributions, providers, input.policies, input.sourceSnapshots);
  const videoSource = resolveSource("video", contributions, providers, input.policies, input.sourceSnapshots);
  const operationalAlertsSource = resolveSource("operationalAlerts", contributions, providers, input.policies, input.sourceSnapshots);
  const videoAlertsSource = resolveSource("videoAlerts", contributions, providers, input.policies, input.sourceSnapshots);
  const gps = snapshotFor(gpsSource, input.sourceSnapshots);
  const video = snapshotFor(videoSource, input.sourceSnapshots);

  return {
    vehicle: {
      id: vehicle.id,
      fleetId: vehicle.placementFleetId,
      label: decodeVehicleLabel(vehicle.name),
      plate: vehicle.plate,
      isActive: true,
    },
    device: video?.device,
    telemetry: gps?.telemetry,
    operationalAlerts: operationalAlertsSource
      ? { kind: "resolved", source: operationalAlertsSource.source }
      : { kind: "unavailable" },
    videoAlerts: videoAlertsSource ? { kind: "resolved", source: videoAlertsSource.source } : { kind: "unavailable" },
  };
}

function decodeVehicleLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function createCatalogLiveProjector() {
  return (input: CatalogLiveInput): LiveState => {
    const assigned = assignedVehicleIds(input);
    const providers = enabledProviders(input);
    const vehicles = input.vehicles.filter((vehicle) => assigned.has(vehicle.id));
    const liveVehicles = vehicles.map((vehicle) => projectVehicle(vehicle, input, providers));
    const liveById = new Map(liveVehicles.map((entry) => [entry.vehicle.id, entry]));
    const fleets = input.fleets
      .map((fleet) => ({
        fleetId: fleet.id,
        label: fleet.label,
        vehicleIds: vehicles.filter((vehicle) => vehicle.placementFleetId === fleet.id && liveById.has(vehicle.id)).map((vehicle) => vehicle.id),
      }))
      .filter((fleet) => fleet.vehicleIds.length > 0);

    return { fleets, liveVehicles };
  };
}

export function createCatalogOperationalSource(
  loadInput: () => Promise<CatalogLiveInput>,
): OperationalSource {
  const project = createCatalogLiveProjector();

  return {
    identity: { id: "canonical-catalog", label: "Catálogo" },
    async loadSnapshot() {
      try {
        return { kind: "success", state: project(await loadInput()) };
      } catch {
        return { kind: "failure", code: "unavailable" };
      }
    },
  };
}
