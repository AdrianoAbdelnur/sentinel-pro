import { DEFAULT_GLOBAL_CAPABILITY_SOURCE_ORDER } from "@/domain/catalog-global";
import type {
  GlobalCapabilityPolicy,
  GlobalVehicle,
  ProviderConnection,
  ProviderContribution,
  TenantVehicleGrant,
} from "@/domain/catalog-global";
import type { Device, DeviceTelemetry } from "@/domain/live";

import type { LiveState, LiveVehicleState } from "./contracts";

export type GlobalCatalogFleet = {
  id: string;
  label: string;
};

export type GlobalCatalogCapabilitySnapshot = {
  device?: Device;
  telemetry?: DeviceTelemetry;
};

export type GlobalCatalogLiveInput = {
  organizationId: string;
  fleets: readonly GlobalCatalogFleet[];
  vehicles: readonly GlobalVehicle[];
  contributions: readonly ProviderContribution[];
  connections: readonly ProviderConnection[];
  policies: readonly GlobalCapabilityPolicy[];
  grants: readonly TenantVehicleGrant[];
  sourceSnapshots: Readonly<Record<string, Readonly<Record<string, GlobalCatalogCapabilitySnapshot>>>>;
};

function sourceOrder(capability: string, policies: readonly GlobalCapabilityPolicy[]): readonly string[] {
  return policies.find((policy) => policy.capability === capability)?.sourceOrder ?? DEFAULT_GLOBAL_CAPABILITY_SOURCE_ORDER[capability] ?? [];
}

function assignedVehicleIds(input: GlobalCatalogLiveInput): Set<string> {
  return new Set(
    input.grants.filter((grant) => grant.organizationId === input.organizationId).map((grant) => grant.vehicleId),
  );
}

function enabledProviders(input: GlobalCatalogLiveInput): Map<string, string> {
  return new Map(input.connections.filter((connection) => connection.enabled).map((connection) => [connection.id, connection.providerId]));
}

type ResolvedCapabilitySource = {
  source: string;
  contribution: ProviderContribution;
};

function resolveSource(
  capability: string,
  contributions: readonly ProviderContribution[],
  providers: Map<string, string>,
  policies: readonly GlobalCapabilityPolicy[],
): ResolvedCapabilitySource | undefined {
  const eligible = new Map<string, ProviderContribution>();
  for (const contribution of contributions) {
    const provider = providers.get(contribution.connectionId);
    const status = contribution.capabilities[capability];
    if (!provider || contribution.presence !== "present" || !status) continue;
    if (status === "eligible") eligible.set(provider, contribution);
  }
  for (const source of sourceOrder(capability, policies)) {
    const contribution = eligible.get(source);
    if (contribution) return { source, contribution };
  }
  return undefined;
}

function snapshotFor(
  resolved: ResolvedCapabilitySource | undefined,
  snapshots: GlobalCatalogLiveInput["sourceSnapshots"],
): GlobalCatalogCapabilitySnapshot | undefined {
  return resolved ? snapshots[resolved.contribution.connectionId]?.[resolved.contribution.externalId] : undefined;
}

function projectVehicle(vehicle: GlobalVehicle, input: GlobalCatalogLiveInput, providers: Map<string, string>): LiveVehicleState {
  const contributions = input.contributions.filter((contribution) => contribution.vehicleId === vehicle.id);
  const gpsSource = resolveSource("gps", contributions, providers, input.policies);
  const videoSource = resolveSource("video", contributions, providers, input.policies);
  const operationalAlertsSource = resolveSource("operationalAlerts", contributions, providers, input.policies);
  const videoAlertsSource = resolveSource("videoAlerts", contributions, providers, input.policies);
  const gps = snapshotFor(gpsSource, input.sourceSnapshots);
  const video = snapshotFor(videoSource, input.sourceSnapshots);

  return {
    vehicle: {
      id: vehicle.id,
      fleetId: vehicle.placementFleetId,
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

export function createGlobalCatalogLiveProjector() {
  return (input: GlobalCatalogLiveInput): LiveState => {
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
