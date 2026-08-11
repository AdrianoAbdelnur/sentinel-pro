import {
  resolveCapabilitySource,
  resolveCredentialRefProvider,
  SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER,
  unionFleetRoster,
  type Capability,
  type CapabilityPolicy,
  type CapabilityResolution,
  type CapabilityScopeIds,
  type CapabilitySourceId,
  type CapabilitySourceStatuses,
  type ExternalFleetIdentity,
  type ExternalVehicleIdentity,
  type Fleet as CatalogFleet,
  type ProviderConnection,
  type Vehicle as CatalogVehicle,
} from "@/domain/catalog";
import type { Device, DeviceTelemetry, Vehicle as LiveVehicleEntity } from "@/domain/live";

import type { LiveFleetState, LiveState, LiveVehicleState } from "./contracts";

const PROJECTED_CAPABILITIES = Object.keys(SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER) as Capability[];

export type CanonicalCapabilitySnapshot = {
  device?: Device;
  telemetry?: DeviceTelemetry;
};

export type CanonicalSourceSnapshots = Record<CapabilitySourceId, Record<string, CanonicalCapabilitySnapshot>>;

export type ProjectCanonicalLiveInput = {
  organizationId: string;
  connections: ProviderConnection[];
  fleets: CatalogFleet[];
  vehicles: CatalogVehicle[];
  fleetIdentities: ExternalFleetIdentity[];
  vehicleIdentities: ExternalVehicleIdentity[];
  capabilityPolicies: CapabilityPolicy[];
  sourceSnapshots: CanonicalSourceSnapshots;
};

type ProviderContribution = {
  identity: ExternalVehicleIdentity;
  provider: CapabilitySourceId;
};

function buildConnectionProviders(connections: ProviderConnection[]): Map<string, CapabilitySourceId> {
  const providers = new Map<string, CapabilitySourceId>();
  for (const connection of connections) {
    const provider = resolveCredentialRefProvider(connection.credentialRef);
    if (provider) providers.set(connection.id, provider);
  }
  return providers;
}

function buildFleetRoster(
  fleet: CatalogFleet,
  fleetIdentities: ExternalFleetIdentity[],
  vehicleIdentities: ExternalVehicleIdentity[],
  vehicles: CatalogVehicle[],
): string[] {
  const placedVehicleIds = new Set(
    vehicles.filter((vehicle) => vehicle.placement.fleetId === fleet.id).map((vehicle) => vehicle.id),
  );
  const boundFleetIdentities = fleetIdentities.filter((identity) => identity.fleetId === fleet.id);

  const attributedRosters = boundFleetIdentities.map((fleetIdentity) =>
    vehicleIdentities
      .filter((identity) => identity.connectionId === fleetIdentity.connectionId && identity.vehicleId !== undefined)
      .map((identity) => identity.vehicleId as string)
      .filter((vehicleId) => placedVehicleIds.has(vehicleId)),
  );

  const attributedVehicleIds = new Set(attributedRosters.flat());
  const unattributedRoster = [...placedVehicleIds].filter((vehicleId) => !attributedVehicleIds.has(vehicleId));

  return unionFleetRoster([...attributedRosters, unattributedRoster]);
}

function collectProviderContributions(
  vehicleId: string,
  vehicleIdentities: ExternalVehicleIdentity[],
  connectionProviders: Map<string, CapabilitySourceId>,
): ProviderContribution[] {
  const contributions: ProviderContribution[] = [];
  for (const identity of vehicleIdentities) {
    if (identity.vehicleId !== vehicleId) continue;
    const provider = connectionProviders.get(identity.connectionId);
    if (!provider) continue;
    contributions.push({ identity, provider });
  }
  return contributions;
}

function resolveVehicleCapabilities(
  organizationId: string,
  vehicle: CatalogVehicle,
  contributions: ProviderContribution[],
  policies: CapabilityPolicy[],
): Record<Capability, CapabilityResolution> {
  const scopeIds: CapabilityScopeIds = {
    vehicle: vehicle.id,
    fleet: vehicle.placement.fleetId,
    company: vehicle.companyId,
    organization: organizationId,
  };

  const resolutions = {} as Record<Capability, CapabilityResolution>;
  for (const capability of PROJECTED_CAPABILITIES) {
    const statuses: CapabilitySourceStatuses = {};
    for (const { identity, provider } of contributions) {
      const status = identity.capabilityStates?.[capability];
      if (status) statuses[provider] = status;
    }
    resolutions[capability] = resolveCapabilitySource(capability, organizationId, scopeIds, policies, statuses);
  }
  return resolutions;
}

function findSnapshot(
  resolution: CapabilityResolution,
  contributions: ProviderContribution[],
  sourceSnapshots: CanonicalSourceSnapshots,
): CanonicalCapabilitySnapshot | undefined {
  if (resolution.kind !== "resolved") return undefined;
  const contribution = contributions.find((entry) => entry.provider === resolution.source);
  return contribution && sourceSnapshots[resolution.source]?.[contribution.identity.externalId];
}

function projectVehicle(
  vehicle: CatalogVehicle,
  input: ProjectCanonicalLiveInput,
  connectionProviders: Map<string, CapabilitySourceId>,
): LiveVehicleState {
  const contributions = collectProviderContributions(vehicle.id, input.vehicleIdentities, connectionProviders);
  const capabilities = resolveVehicleCapabilities(input.organizationId, vehicle, contributions, input.capabilityPolicies);

  const videoSnapshot = findSnapshot(capabilities.video, contributions, input.sourceSnapshots);
  const gpsSnapshot = findSnapshot(capabilities.gps, contributions, input.sourceSnapshots);

  const liveVehicle: LiveVehicleEntity = {
    id: vehicle.id,
    fleetId: vehicle.placement.fleetId,
    label: vehicle.label,
    plate: vehicle.plate,
    internalCode: vehicle.internalCode,
    isActive: true,
  };

  return { vehicle: liveVehicle, device: videoSnapshot?.device, telemetry: gpsSnapshot?.telemetry };
}

export function projectCanonicalLive(input: ProjectCanonicalLiveInput): LiveState {
  const connectionProviders = buildConnectionProviders(input.connections);

  const fleets: LiveFleetState[] = input.fleets.map((fleet) => ({
    fleetId: fleet.id,
    label: fleet.name,
    vehicleIds: buildFleetRoster(fleet, input.fleetIdentities, input.vehicleIdentities, input.vehicles),
  }));

  const liveVehicles = input.vehicles.map((vehicle) => projectVehicle(vehicle, input, connectionProviders));

  return { fleets, liveVehicles };
}

